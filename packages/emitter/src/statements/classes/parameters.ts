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
import { identifierType } from "../../core/format/backend-ast/builders.js";
import type {
  CSharpExpressionAst,
  CSharpParameterAst,
  CSharpStatementAst,
  CSharpTypeAst,
} from "../../core/format/backend-ast/types.js";
import {
  canEmitParameterDefaultInSignature,
  computeWrapperPrefixLengths,
  isCSharpOptionalParameterDefaultAst,
  RuntimeParameterDefaultInfo,
  supportsNullCoalescingParameterDefault,
} from "../parameter-defaults.js";

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
  /** Runtime defaults that must be applied in the body instead of the signature */
  readonly runtimeDefaultInitializers: readonly RuntimeParameterDefaultInfo[];
  /** Wrapper arities needed when omitted suffixes cannot be expressed in C# signatures */
  readonly wrapperPrefixLengths: readonly number[];
  /** Synthesized default arguments for suppressed parameters */
  readonly suppressedDefaultArguments: readonly (CSharpExpressionAst | undefined)[];
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
  const runtimeDefaultInitializers: RuntimeParameterDefaultInfo[] = [];
  const suppressedDefaultArguments: Array<CSharpExpressionAst | undefined> = [];
  const suppressedDefaultIndexes = new Set<number>();
  let syntheticParamIndex = 0;

  for (let index = 0; index < parameters.length; index += 1) {
    const param = parameters[index];
    if (!param) continue;
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
    if (param.isRest) {
      modifiers.push("params");
    }
    // Use the passing mode from IR (frontend already unwrapped ref<T>/out<T>/in<T>)
    if (param.passing !== "value") {
      modifiers.push(param.passing);
    }

    const actualType: IrType | undefined = param.type;

    // Parameter type
    let typeAst: CSharpTypeAst = identifierType("object");
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
      const canEmitInSignature =
        canEmitParameterDefaultInSignature(parameters, index) &&
        isCSharpOptionalParameterDefaultAst(defaultAst);
      if (canEmitInSignature) {
        defaultValue = defaultAst;
      } else {
        suppressedDefaultIndexes.add(index);
        suppressedDefaultArguments[index] = defaultAst;
        if (!supportsNullCoalescingParameterDefault(typeAst)) {
          throw new Error(
            `ICE: Unsupported runtime parameter default lowering for '${paramName}'.`
          );
        }
        runtimeDefaultInitializers.push({
          paramName,
          typeAst,
          initializer: defaultAst,
        });
      }
    } else if (isOptional && !isRest) {
      if (canEmitParameterDefaultInSignature(parameters, index)) {
        defaultValue = { kind: "defaultExpression" };
      } else {
        suppressedDefaultIndexes.add(index);
        suppressedDefaultArguments[index] = {
          kind: "defaultExpression",
          type: typeAst,
        };
      }
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
    runtimeDefaultInitializers,
    wrapperPrefixLengths: computeWrapperPrefixLengths(
      parameters,
      suppressedDefaultIndexes
    ),
    suppressedDefaultArguments,
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
