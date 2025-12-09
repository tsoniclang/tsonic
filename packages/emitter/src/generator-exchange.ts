/**
 * Generator Exchange Object Generator
 * Per spec/13-generators.md - Generate exchange objects for bidirectional communication
 */

import { IrModule, IrFunctionDeclaration } from "@tsonic/frontend";
import { EmitterContext, getIndent, indent } from "./types.js";
import { emitType } from "./type-emitter.js";
import {
  needsBidirectionalSupport,
  generateWrapperClass,
  generateIteratorResultStruct,
} from "./generator-wrapper.js";

/**
 * Collect all generator functions from a module
 */
const collectGenerators = (module: IrModule): IrFunctionDeclaration[] => {
  const generators: IrFunctionDeclaration[] = [];

  for (const stmt of module.body) {
    if (stmt.kind === "functionDeclaration" && stmt.isGenerator) {
      generators.push(stmt);
    }
    // TODO: Also handle generator methods in classes
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

  const exchangeName = `${func.name}_exchange`;

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
        const [yieldType, newContext1] = emitType(yieldTypeArg, currentContext);
        currentContext = newContext1;
        outputType = yieldType;
      }

      if (typeRef.typeArguments.length > 2) {
        const nextTypeArg = typeRef.typeArguments[2];
        if (nextTypeArg) {
          const [nextType, newContext2] = emitType(nextTypeArg, currentContext);
          currentContext = newContext2;
          inputType = nextType;
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

  // Check if any generator needs bidirectional support
  const hasBidirectional = generators.some((g) => needsBidirectionalSupport(g));

  // Generate IteratorResult struct if needed (once per module)
  if (hasBidirectional) {
    const [iteratorResultCode, newContext] = generateIteratorResultStruct(
      currentContext
    );
    currentContext = newContext;
    parts.push(iteratorResultCode);
    parts.push("");
  }

  // Generate exchange classes and wrapper classes for each generator
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
