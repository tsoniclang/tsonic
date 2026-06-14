import {
  buildResolvedRestParameter,
  expandParameterTypesForArguments,
} from "../../../type-system/type-system-call-resolution.js";
import type { ProgramContext } from "../../../program-context.js";
import type { IrCallExpression, IrType } from "../../../types.js";
import type { IrParameter } from "../../../types.js";
import { getNumericKindFromIrType } from "../../../type-system/inference-utilities.js";

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

type BoundGlobalCallLookup = {
  readonly ownerIdentity: string;
  readonly providerQualifiedName: string;
  readonly memberName: string;
};

const getBoundGlobalCallLookup = (
  callee: IrCallExpression["callee"]
): BoundGlobalCallLookup | undefined => {
  if (
    callee.kind === "identifier" &&
    callee.providerOwnerIdentity &&
    callee.providerQualifiedName &&
    callee.providerMemberName
  ) {
    const memberName = callee.providerMemberName.split(".").pop();
    return memberName
      ? {
          ownerIdentity: callee.providerOwnerIdentity,
          providerQualifiedName: callee.providerQualifiedName,
          memberName,
        }
      : undefined;
  }

  if (callee.kind === "memberAccess" && callee.memberBinding?.kind === "method") {
    return {
      ownerIdentity: callee.memberBinding.ownerIdentity,
      providerQualifiedName: callee.memberBinding.type,
      memberName: callee.memberBinding.member,
    };
  }

  return undefined;
};

export const getBoundGlobalCallParameterTypes = (
  callee: IrCallExpression["callee"],
  argumentCount: number,
  actualArgTypes: readonly (IrType | undefined)[] | undefined,
  ctx: ProgramContext
): BoundGlobalCallParameterTypes => {
  const lookup = getBoundGlobalCallLookup(callee);
  if (!lookup) {
    return undefined;
  }

  const overloads = ctx.bindings
    .getTargetMemberOverloads(
      lookup.ownerIdentity,
      lookup.providerQualifiedName,
      lookup.memberName
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

  const selected =
    arityCompatible.length === 1
      ? arityCompatible[0]
      : selectBoundGlobalOverloadByActualArguments(
          arityCompatible,
          argumentCount,
          actualArgTypes,
          ctx
        );

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

const NEGATIVE_INFINITY = Number.NEGATIVE_INFINITY;

const nonNullishMembers = (type: IrType): readonly IrType[] =>
  type.kind === "unionType"
    ? type.types.filter(
        (member) =>
          !(
            member.kind === "primitiveType" &&
            (member.name === "null" || member.name === "undefined")
          )
      )
    : [type];

const scoreNumericParameter = (
  parameterType: IrType,
  actualType: IrType
): number | undefined => {
  const actualKind = getNumericKindFromIrType(actualType);
  const parameterKind = getNumericKindFromIrType(parameterType);
  if (!actualKind || !parameterKind) {
    return undefined;
  }

  if (actualKind === "float64") {
    return parameterKind === "float64" ? 90 : NEGATIVE_INFINITY;
  }

  if (actualKind === parameterKind) {
    return 100;
  }

  return undefined;
};

const scoreParameterForActualArgument = (
  parameterType: IrType | undefined,
  actualType: IrType | undefined,
  ctx: ProgramContext
): number | undefined => {
  if (!parameterType || !actualType) {
    return 0;
  }

  const memberScores = nonNullishMembers(parameterType).map((member) => {
    if (ctx.typeSystem.typesEqual(actualType, member)) {
      return 120;
    }

    const numericScore = scoreNumericParameter(member, actualType);
    if (numericScore !== undefined) {
      return numericScore;
    }

    if (ctx.typeSystem.isAssignableTo(actualType, member)) {
      return member.kind === "unknownType" || member.kind === "anyType" ? 10 : 70;
    }

    return NEGATIVE_INFINITY;
  });

  const bestScore = Math.max(...memberScores);
  return bestScore === NEGATIVE_INFINITY ? undefined : bestScore;
};

const selectBoundGlobalOverloadByActualArguments = <
  TOverload extends {
    readonly semanticSignature: {
      readonly parameters: readonly IrParameter[];
      readonly returnType?: IrType | undefined;
    };
  },
>(
  overloads: readonly TOverload[],
  argumentCount: number,
  actualArgTypes: readonly (IrType | undefined)[] | undefined,
  ctx: ProgramContext
): TOverload | undefined => {
  if (!actualArgTypes || actualArgTypes.length === 0) {
    return undefined;
  }

  let selected: TOverload | undefined;
  let selectedScore = NEGATIVE_INFINITY;
  let tied = false;

  for (const overload of overloads) {
    const parameterTypes = expandParameterTypesForArguments(
      overload.semanticSignature.parameters,
      overload.semanticSignature.parameters.map((parameter) => parameter.type),
      argumentCount
    );
    let score = 0;
    let accepts = true;

    for (let index = 0; index < argumentCount; index += 1) {
      const parameterScore = scoreParameterForActualArgument(
        parameterTypes[index],
        actualArgTypes[index],
        ctx
      );
      if (parameterScore === undefined) {
        accepts = false;
        break;
      }
      score += parameterScore;
    }

    if (!accepts) {
      continue;
    }

    if (score > selectedScore) {
      selected = overload;
      selectedScore = score;
      tied = false;
      continue;
    }

    if (score === selectedScore) {
      tied = true;
    }
  }

  return tied ? undefined : selected;
};
