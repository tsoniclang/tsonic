import {
  getAwaitedIrType,
  type IrParameter,
  type IrType,
} from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitTypeAst } from "../../type-emitter.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import { escapeCSharpIdentifier } from "../../emitter-types/index.js";
import { lowerPatternAst } from "../../patterns.js";
import { allocateLocalName } from "../../core/format/local-names.js";
import { registerParameterTypes } from "../../core/semantic/symbol-types.js";
import { stripNullableTypeAst } from "../../core/format/backend-ast/utils.js";
import {
  identifierType,
  nullableType,
} from "../../core/format/backend-ast/builders.js";
import type {
  CSharpStatementAst,
  CSharpParameterAst,
  CSharpTypeAst,
  CSharpExpressionAst,
} from "../../core/format/backend-ast/types.js";
import { registerLocalName } from "../../core/format/local-names.js";
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

export type SavedFunctionScopeContext = {
  readonly typeParameters: EmitterContext["typeParameters"];
  readonly typeParamConstraints: EmitterContext["typeParamConstraints"];
  readonly typeParameterNameMap: EmitterContext["typeParameterNameMap"];
  readonly returnType: EmitterContext["returnType"];
  readonly narrowedBindings: EmitterContext["narrowedBindings"];
  readonly voidResolveNames: EmitterContext["voidResolveNames"];
  readonly promiseResolveValueTypes: EmitterContext["promiseResolveValueTypes"];
  readonly localNameMap: EmitterContext["localNameMap"];
  readonly localSemanticTypes: EmitterContext["localSemanticTypes"];
  readonly localValueTypes: EmitterContext["localValueTypes"];
  readonly usedLocalNames: EmitterContext["usedLocalNames"];
};

export const captureFunctionScopeContext = (
  context: EmitterContext
): SavedFunctionScopeContext => ({
  typeParameters: context.typeParameters,
  typeParamConstraints: context.typeParamConstraints,
  typeParameterNameMap: context.typeParameterNameMap,
  returnType: context.returnType,
  narrowedBindings: context.narrowedBindings,
  voidResolveNames: context.voidResolveNames,
  promiseResolveValueTypes: context.promiseResolveValueTypes,
  localNameMap: context.localNameMap,
  localSemanticTypes: context.localSemanticTypes,
  localValueTypes: context.localValueTypes,
  usedLocalNames: context.usedLocalNames,
});

export const getAsyncBodyReturnType = (
  isAsync: boolean,
  returnType: IrType | undefined
): IrType | undefined => {
  if (!isAsync || !returnType) return returnType;
  return getAwaitedIrType(returnType) ?? returnType;
};

export const seedLocalNameMapFromParameters = (
  params: readonly IrParameter[],
  context: EmitterContext
): EmitterContext => {
  const map = new Map(context.localNameMap ?? []);
  let currentContext = context;
  const used = new Set<string>();
  for (const p of params) {
    if (p.pattern.kind === "identifierPattern") {
      const emitted = escapeCSharpIdentifier(p.pattern.name);
      map.set(p.pattern.name, emitted);
      used.add(emitted);
      currentContext = registerParameterTypes(
        p.pattern.name,
        p.type,
        (p.isOptional || p.initializer !== undefined) && !p.isRest,
        currentContext
      );
    }
  }
  return {
    ...currentContext,
    localNameMap: map,
    usedLocalNames: used,
  };
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

export const restoreFunctionScopeContext = (
  outerContext: EmitterContext,
  innerContext: EmitterContext,
  savedScoped: SavedFunctionScopeContext
): EmitterContext => ({
  ...outerContext,
  ...innerContext,
  ...savedScoped,
  indentLevel: outerContext.indentLevel,
  isStatic: outerContext.isStatic,
  isAsync: outerContext.isAsync,
  className: outerContext.className,
  localSemanticTypes: outerContext.localSemanticTypes,
  localValueTypes: outerContext.localValueTypes,
});

export type DestructuringParamInfo = {
  readonly syntheticName: string;
  readonly pattern: IrParameter["pattern"];
  readonly type: IrType | undefined;
};

export const buildParameterAsts = (
  parameters: readonly IrParameter[],
  context: EmitterContext
): {
  readonly paramAsts: readonly CSharpParameterAst[];
  readonly destructuringParams: readonly DestructuringParamInfo[];
  readonly runtimeDefaultInitializers: readonly RuntimeParameterDefaultInfo[];
  readonly wrapperPrefixLengths: readonly number[];
  readonly suppressedDefaultArguments: readonly (
    | CSharpExpressionAst
    | undefined
  )[];
  readonly context: EmitterContext;
} => {
  let currentCtx = context;
  const paramAsts: CSharpParameterAst[] = [];
  const destructuringParams: DestructuringParamInfo[] = [];
  const runtimeDefaultInitializers: RuntimeParameterDefaultInfo[] = [];
  const suppressedDefaultArguments: Array<CSharpExpressionAst | undefined> = [];
  const suppressedDefaultIndexes = new Set<number>();
  let syntheticIndex = 0;

  for (let index = 0; index < parameters.length; index += 1) {
    const param = parameters[index];
    if (!param) continue;
    const acceptsExplicitUndefined =
      (param.isOptional || param.initializer !== undefined) && !param.isRest;
    let typeAst: CSharpTypeAst = identifierType("object");
    if (param.type) {
      const [t, c] = emitTypeAst(param.type, currentCtx);
      typeAst = t;
      currentCtx = c;
    }

    if (acceptsExplicitUndefined) {
      typeAst = nullableType(typeAst);
    }

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

    const modifiers: string[] = [];
    if (param.isExtensionReceiver) modifiers.push("this");
    if (param.isRest) modifiers.push("params");
    if (param.passing !== "value") modifiers.push(param.passing);

    let defaultValue: CSharpExpressionAst | undefined;
    if (param.initializer) {
      const [ast, c] = emitExpressionAst(param.initializer, currentCtx);
      currentCtx = c;
      const canEmitInSignature =
        canEmitParameterDefaultInSignature(parameters, index) &&
        isCSharpOptionalParameterDefaultAst(ast);
      defaultValue = signatureDefaultForInitializedParameter(
        parameters,
        index,
        typeAst,
        ast
      );

      if (supportsNullCoalescingParameterDefault(typeAst)) {
        runtimeDefaultInitializers.push({
          paramName: name,
          typeAst,
          initializer: ast,
          sourceName:
            param.pattern.kind === "identifierPattern"
              ? param.pattern.name
              : undefined,
          semanticType: param.type,
        });
      } else if (!canEmitInSignature) {
        suppressedDefaultIndexes.add(index);
        suppressedDefaultArguments[index] = ast;
        if (!canLowerParameterDefaultViaWrapper(parameters, index)) {
          throw new Error(
            `ICE: Unsupported runtime parameter default lowering for '${name}'.`
          );
        }
      }
    } else if (param.isOptional && !param.isRest) {
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

    paramAsts.push({
      name,
      type: typeAst,
      defaultValue,
      modifiers: modifiers.length > 0 ? modifiers : undefined,
    });
  }

  return {
    paramAsts,
    destructuringParams,
    runtimeDefaultInitializers,
    wrapperPrefixLengths: computeWrapperPrefixLengths(
      parameters,
      suppressedDefaultIndexes
    ),
    suppressedDefaultArguments,
    context: currentCtx,
  };
};

export const generateParameterDestructuringAst = (
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

export const reserveGeneratorLocals = (
  context: EmitterContext,
  isGenerator: boolean,
  isBidirectional: boolean,
  hasGeneratorReturnType: boolean
): {
  readonly context: EmitterContext;
  readonly generatorExchangeVar: string;
  readonly generatorIteratorFn: string;
  readonly generatorReturnValueVar: string;
} => {
  let currentContext = context;
  let generatorExchangeVar = "exchange";
  let generatorIteratorFn = "__iterator";
  let generatorReturnValueVar = "__returnValue";

  if (!isGenerator) {
    return {
      context: currentContext,
      generatorExchangeVar,
      generatorIteratorFn,
      generatorReturnValueVar,
    };
  }

  const exchangeAlloc = allocateLocalName(generatorExchangeVar, currentContext);
  generatorExchangeVar = exchangeAlloc.emittedName;
  currentContext = { ...exchangeAlloc.context, generatorExchangeVar };

  if (isBidirectional) {
    const iterAlloc = allocateLocalName(generatorIteratorFn, currentContext);
    generatorIteratorFn = iterAlloc.emittedName;
    currentContext = iterAlloc.context;

    if (hasGeneratorReturnType) {
      const retAlloc = allocateLocalName(
        generatorReturnValueVar,
        currentContext
      );
      generatorReturnValueVar = retAlloc.emittedName;
      currentContext = { ...retAlloc.context, generatorReturnValueVar };
    }
  }

  return {
    context: currentContext,
    generatorExchangeVar,
    generatorIteratorFn,
    generatorReturnValueVar,
  };
};
