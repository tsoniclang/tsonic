/**
 * Parameter emission for functions and methods
 *
 * Handles both simple identifier patterns and destructuring patterns.
 * For destructuring patterns, generates synthetic parameter names (__param0, etc.)
 * and returns lowering info for the caller to inject destructuring statements.
 */

import { IrParameter, IrType } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpression } from "../../expression-emitter.js";
import { emitParameterType } from "../../type-emitter.js";
import { escapeCSharpIdentifier } from "../../emitter-types/index.js";
import { lowerParameterPattern } from "../../patterns.js";
import { emitParameterAttributes } from "../../core/attributes.js";

/**
 * Info about a parameter that needs destructuring in the function body
 */
type ParameterDestructuringInfo = {
  readonly syntheticName: string;
  readonly pattern: IrParameter["pattern"];
  readonly type: IrType | undefined;
};

/**
 * Result of parameter emission
 */
export type ParameterEmissionResult = {
  /** The C# parameter list string */
  readonly parameterList: string;
  /** Parameters that need destructuring in the function body */
  readonly destructuringParams: readonly ParameterDestructuringInfo[];
  /** Updated context */
  readonly context: EmitterContext;
};

/**
 * Emit parameters for functions and methods
 *
 * For simple identifier patterns, emits directly as C# parameters.
 * For complex patterns (array/object), generates synthetic parameter names
 * and returns info for destructuring in the function body.
 */
export const emitParameters = (
  parameters: readonly IrParameter[],
  context: EmitterContext
): [string, EmitterContext] => {
  const result = emitParametersWithDestructuring(parameters, context);
  return [result.parameterList, result.context];
};

/**
 * Emit parameters with full destructuring support
 *
 * Returns both the parameter list and info about parameters that need
 * destructuring statements in the function body.
 */
export const emitParametersWithDestructuring = (
  parameters: readonly IrParameter[],
  context: EmitterContext
): ParameterEmissionResult => {
  let currentContext = context;
  const params: string[] = [];
  const destructuringParams: ParameterDestructuringInfo[] = [];
  let syntheticParamIndex = 0;

  for (const param of parameters) {
    const isRest = param.isRest;
    const isOptional = param.isOptional;

    const [parameterAttributePrefix, attrContext] = emitParameterAttributes(
      param.attributes,
      currentContext
    );
    currentContext = attrContext;

    const modifiers: string[] = [];
    if (param.isExtensionReceiver) {
      modifiers.push("this");
    }
    // Use the passing mode from IR (frontend already unwrapped ref<T>/out<T>/in<T>)
    if (param.passing !== "value") {
      modifiers.push(param.passing);
    }
    const modifierPrefix = modifiers.length > 0 ? `${modifiers.join(" ")} ` : "";
    const actualType: IrType | undefined = param.type;

    // Parameter type
    let paramType = "object";
    if (actualType) {
      const [typeName, newContext] = emitParameterType(
        actualType,
        isOptional,
        currentContext
      );
      currentContext = newContext;
      paramType = typeName;
      // Rest parameters use native T[] arrays with params modifier
    }

    // Determine parameter name based on pattern kind
    let paramName: string;
    const isComplexPattern =
      param.pattern.kind === "arrayPattern" ||
      param.pattern.kind === "objectPattern";

    if (isComplexPattern) {
      // Generate synthetic name for complex patterns
      paramName = `__param${syntheticParamIndex}`;
      syntheticParamIndex++;
      // Record for destructuring in function body
      destructuringParams.push({
        syntheticName: paramName,
        pattern: param.pattern,
        type: actualType,
      });
    } else if (param.pattern.kind === "identifierPattern") {
      paramName = escapeCSharpIdentifier(param.pattern.name);
    } else {
      paramName = "param";
    }

    // Construct parameter string with modifiers if present
    let paramStr = `${parameterAttributePrefix}${modifierPrefix}${paramType} ${paramName}`;
    if (param.initializer) {
      // Emit the default value directly
      const [defaultExpr, newContext] = emitExpression(
        param.initializer,
        currentContext
      );
      currentContext = newContext;
      paramStr = `${modifierPrefix}${paramType} ${paramName} = ${defaultExpr.text}`;
    } else if (isOptional && !isRest) {
      paramStr += " = default";
    }

    params.push(paramStr);
  }

  return {
    parameterList: params.join(", "),
    destructuringParams,
    context: currentContext,
  };
};

/**
 * Generate destructuring statements for parameters
 *
 * Call this after emitParametersWithDestructuring to get the statements
 * that should be injected at the start of the function body.
 */
export const generateParameterDestructuring = (
  destructuringParams: readonly ParameterDestructuringInfo[],
  indent: string,
  context: EmitterContext
): [readonly string[], EmitterContext] => {
  let currentContext = context;
  const statements: string[] = [];

  for (const info of destructuringParams) {
    const result = lowerParameterPattern(
      info.pattern,
      info.syntheticName,
      info.type,
      indent,
      currentContext
    );
    statements.push(...result.statements);
    currentContext = result.context;
  }

  return [statements, currentContext];
};
