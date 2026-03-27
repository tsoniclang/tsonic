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
import { allocateLocalName, registerLocalName } from "../../core/format/local-names.js";
import { identifierType } from "../../core/format/backend-ast/builders.js";
import { stripNullableTypeAst } from "../../core/format/backend-ast/utils.js";
import type {
  CSharpExpressionAst,
  CSharpParameterAst,
  CSharpStatementAst,
  CSharpTypeAst,
} from "../../core/format/backend-ast/types.js";
import {
  canLowerParameterDefaultViaWrapper,
  canEmitParameterDefaultInSignature,
  computeWrapperPrefixLengths,
  isCSharpOptionalParameterDefaultAst,
  preservesNullableShadowType,
  RuntimeParameterDefaultInfo,
  signatureDefaultForInitializedParameter,
  supportsNullCoalescingParameterDefault,
} from "../parameter-defaults.js";
import { registerParameterTypes } from "../../core/semantic/symbol-types.js";

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

export const applyRuntimeParameterDefaultShadows = (
  runtimeDefaults: readonly RuntimeParameterDefaultInfo[],
  context: EmitterContext
): [readonly CSharpStatementAst[], EmitterContext] => {
  let currentContext = context;
  const statements: CSharpStatementAst[] = [];

  for (const runtimeDefault of runtimeDefaults) {
    if (!runtimeDefault.sourceName) {
      continue;
    }

    const allocated = allocateLocalName(
      `__defaulted_${runtimeDefault.sourceName}`,
      currentContext
    );
    currentContext = registerLocalName(
      runtimeDefault.sourceName,
      allocated.emittedName,
      allocated.context
    );
    currentContext = registerParameterTypes(
      runtimeDefault.sourceName,
      runtimeDefault.semanticType,
      false,
      currentContext
    );

    statements.push({
      kind: "localDeclarationStatement",
      modifiers: [],
      type:
        runtimeDefault.typeAst.kind === "nullableType" &&
        preservesNullableShadowType(runtimeDefault.initializer)
          ? runtimeDefault.typeAst
          : stripNullableTypeAst(runtimeDefault.typeAst),
      declarators: [
        {
          name: allocated.emittedName,
          initializer: {
            kind: "binaryExpression",
            operatorToken: "??",
            left: {
              kind: "identifierExpression",
              identifier: runtimeDefault.paramName,
            },
            right: runtimeDefault.initializer,
          },
        },
      ],
    });
  }

  return [statements, currentContext];
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
    const acceptsExplicitUndefined =
      (param.isOptional || param.initializer !== undefined) && !param.isRest;

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
        acceptsExplicitUndefined,
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
      defaultValue = signatureDefaultForInitializedParameter(
        parameters,
        index,
        typeAst,
        defaultAst
      );

      if (supportsNullCoalescingParameterDefault(typeAst)) {
        runtimeDefaultInitializers.push({
          paramName,
          typeAst,
          initializer: defaultAst,
          sourceName:
            param.pattern.kind === "identifierPattern"
              ? param.pattern.name
              : undefined,
          semanticType: param.type,
        });
      } else if (!canEmitInSignature) {
        suppressedDefaultIndexes.add(index);
        suppressedDefaultArguments[index] = defaultAst;
        if (!canLowerParameterDefaultViaWrapper(parameters, index)) {
          throw new Error(
            `ICE: Unsupported runtime parameter default lowering for '${paramName}'.`
          );
        }
      }
    } else if (param.isOptional && !isRest) {
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
