import {
  buildResolvedRestParameter,
  expandParameterTypesForArguments,
} from "../../../type-system/type-system-call-resolution.js";
import type { ProgramContext } from "../../../program-context.js";
import type { IrCallExpression, IrType } from "../../../types.js";
import type { IrParameter } from "../../../types.js";

const isArityCompatibleForSemanticParameters = (
  parameters: readonly IrParameter[],
  argumentCount: number
): boolean => {
  let requiredCount = 0;
  let hasRest = false;

  for (const parameter of parameters) {
    if (parameter.isRest) {
      hasRest = true;
      continue;
    }

    if (!parameter.isOptional && parameter.initializer === undefined) {
      requiredCount += 1;
    }
  }

  if (argumentCount < requiredCount) {
    return false;
  }

  if (!hasRest && argumentCount > parameters.length) {
    return false;
  }

  return true;
};

export type BoundGlobalCallParameterTypes =
  | {
      readonly parameterTypes: readonly (IrType | undefined)[];
      readonly returnType: IrType | undefined;
      readonly restParameter:
        | {
            readonly index: number;
            readonly arrayType: IrType | undefined;
            readonly elementType: IrType | undefined;
          }
        | undefined;
    }
  | undefined;

export const getBoundGlobalCallParameterTypes = (
  callee: IrCallExpression["callee"],
  argumentCount: number,
  ctx: ProgramContext
): BoundGlobalCallParameterTypes => {
  if (
    callee.kind !== "identifier" ||
    !callee.resolvedAssembly ||
    !callee.resolvedClrType ||
    !callee.csharpName
  ) {
    return undefined;
  }

  const memberName = callee.csharpName.split(".").pop();
  if (!memberName) {
    return undefined;
  }

  const overloads = ctx.bindings
    .getClrMemberOverloads(
      callee.resolvedAssembly,
      callee.resolvedClrType,
      memberName
    )
    ?.filter(
      (
        overload
      ): overload is typeof overload & {
        readonly semanticSignature: NonNullable<
          typeof overload.semanticSignature
        >;
      } => overload.semanticSignature !== undefined
    );

  if (!overloads || overloads.length === 0) {
    return undefined;
  }

  const arityCompatible = overloads.filter((overload) =>
    isArityCompatibleForSemanticParameters(
      overload.semanticSignature.parameters,
      argumentCount
    )
  );

  if (arityCompatible.length !== 1) {
    return undefined;
  }

  const [selected] = arityCompatible;
  if (!selected) {
    return undefined;
  }
  const parameterTypes = expandParameterTypesForArguments(
    selected.semanticSignature.parameters,
    selected.semanticSignature.parameters.map((parameter) => parameter.type),
    argumentCount
  );

  return {
    parameterTypes,
    returnType: selected.semanticSignature.returnType,
    restParameter: buildResolvedRestParameter(
      selected.semanticSignature.parameters.map((parameter) => ({
        isRest: parameter.isRest,
      })),
      parameterTypes
    ),
  };
};
