/**
 * Parameter emission for functions and methods
 *
 * Handles both simple identifier patterns and destructuring patterns.
 * For destructuring patterns, generates synthetic parameter names (__param0, etc.)
 * and returns lowering info for the caller to inject destructuring statements.
 */

import { IrParameter, IrType } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import { emitParameterType } from "../../type-emitter.js";
import { escapeCSharpIdentifier } from "../../emitter-types/index.js";
import { lowerPatternAst } from "../../patterns.js";
import { emitParameterAttributes } from "../../core/format/attributes.js";
import type {
  CSharpExpressionAst,
  CSharpParameterAst,
  CSharpStatementAst,
  CSharpTypeAst,
} from "../../core/format/backend-ast/types.js";

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
  /** The C# parameter ASTs */
  readonly parameters: readonly CSharpParameterAst[];
  /** Parameters that need destructuring in the function body */
  readonly destructuringParams: readonly ParameterDestructuringInfo[];
  /** Updated context */
  readonly context: EmitterContext;
};

/**
 * Emit parameters for functions and methods as CSharpParameterAst[].
 *
 * For simple identifier patterns, emits directly as C# parameters.
 * For complex patterns (array/object), generates synthetic parameter names
 * and returns info for destructuring in the function body.
 */
export const emitParameters = (
  parameters: readonly IrParameter[],
  context: EmitterContext
): [readonly CSharpParameterAst[], EmitterContext] => {
  const result = emitParametersWithDestructuring(parameters, context);
  return [result.parameters, result.context];
};

/**
 * Emit parameters with full destructuring support
 *
 * Returns both the parameter ASTs and info about parameters that need
 * destructuring statements in the function body.
 */
export const emitParametersWithDestructuring = (
  parameters: readonly IrParameter[],
  context: EmitterContext
): ParameterEmissionResult => {
  let currentContext = context;
  const params: CSharpParameterAst[] = [];
  const destructuringParams: ParameterDestructuringInfo[] = [];
  let syntheticParamIndex = 0;

  for (const param of parameters) {
    const isRest = param.isRest;
    const isOptional = param.isOptional;

    const [paramAttrs, attrContext] = emitParameterAttributes(
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

    const actualType: IrType | undefined = param.type;

    // Parameter type
    let typeAst: CSharpTypeAst = { kind: "identifierType", name: "object" };
    if (actualType) {
      const [tAst, newContext] = emitParameterType(
        actualType,
        isOptional,
        currentContext
      );
      currentContext = newContext;
      typeAst = tAst;
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

    // Default value
    let defaultValue: CSharpExpressionAst | undefined;
    if (param.initializer) {
      const [defaultAst, newContext] = emitExpressionAst(
        param.initializer,
        currentContext
      );
      currentContext = newContext;
      defaultValue = defaultAst;
    } else if (isOptional && !isRest) {
      defaultValue = { kind: "defaultExpression" };
    }

    params.push({
      name: paramName,
      type: typeAst,
      ...(defaultValue ? { defaultValue } : {}),
      ...(modifiers.length > 0 ? { modifiers } : {}),
      ...(paramAttrs.length > 0 ? { attributes: paramAttrs } : {}),
    });
  }

  return {
    parameters: params,
    destructuringParams,
    context: currentContext,
  };
};

/**
 * Generate destructuring statements as AST nodes.
 */
export const generateParameterDestructuringAst = (
  destructuringParams: readonly ParameterDestructuringInfo[],
  context: EmitterContext
): [readonly CSharpStatementAst[], EmitterContext] => {
  let currentContext = context;
  const statements: CSharpStatementAst[] = [];

  for (const info of destructuringParams) {
    const inputExpr = {
      kind: "identifierExpression" as const,
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
