import type { IrExpression, IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import {
  resolveLocalTypeInfo,
  resolveTypeAlias,
  stripNullish,
  substituteTypeArgs,
} from "./type-resolution.js";

type StructuralViewExpression = Extract<
  IrExpression,
  { kind: "asinterface" | "typeAssertion" | "trycast" }
>;

type MethodLikeMember = {
  readonly kind: string;
  readonly name?: string;
  readonly typeParameters?: readonly { readonly name: string }[];
  readonly parameters?: readonly { readonly type?: IrType }[];
  readonly returnType?: IrType;
};

export type StructuralViewMethodSurface = {
  readonly parameterTypes: readonly (IrType | undefined)[];
  readonly returnType?: IrType;
};

const isStructuralViewExpression = (
  expression: IrExpression,
  includeErasedAsInterface: boolean
): expression is StructuralViewExpression =>
  (includeErasedAsInterface && expression.kind === "asinterface") ||
  expression.kind === "typeAssertion" ||
  expression.kind === "trycast";

const substituteMemberType = (
  type: IrType | undefined,
  typeParameterNames: readonly string[] | undefined,
  typeArguments: readonly IrType[] | undefined
): IrType | undefined =>
  type && typeParameterNames && typeArguments
    ? substituteTypeArgs(type, typeParameterNames, typeArguments)
    : type;

const findMethodSurface = (
  members: readonly MethodLikeMember[] | undefined,
  memberName: string,
  typeParameterNames: readonly string[] | undefined,
  typeArguments: readonly IrType[] | undefined
): StructuralViewMethodSurface | undefined => {
  const method = members?.find(
    (member) =>
      (member.kind === "methodSignature" ||
        member.kind === "methodDeclaration") &&
      member.name === memberName
  );
  if (!method?.parameters) {
    return undefined;
  }

  return {
    parameterTypes: method.parameters.map((parameter) =>
      substituteMemberType(parameter.type, typeParameterNames, typeArguments)
    ),
    returnType: substituteMemberType(
      method.returnType,
      typeParameterNames,
      typeArguments
    ),
  };
};

export const resolveStructuralViewMethodSurface = (
  callee: IrExpression,
  context: EmitterContext,
  options: { readonly includeErasedAsInterface?: boolean } = {}
): StructuralViewMethodSurface | undefined => {
  if (
    callee.kind !== "memberAccess" ||
    callee.isComputed ||
    typeof callee.property !== "string" ||
    !isStructuralViewExpression(
      callee.object,
      options.includeErasedAsInterface === true
    )
  ) {
    return undefined;
  }

  const targetType = callee.object.targetType;
  const memberName = callee.property;
  const resolvedTarget = resolveTypeAlias(stripNullish(targetType), context);
  if (resolvedTarget.kind === "objectType") {
    return findMethodSurface(
      resolvedTarget.members,
      memberName,
      undefined,
      undefined
    );
  }

  if (resolvedTarget.kind !== "referenceType") {
    return undefined;
  }

  const structuralSurface = findMethodSurface(
    resolvedTarget.structuralMembers,
    memberName,
    undefined,
    undefined
  );
  if (structuralSurface) {
    return structuralSurface;
  }

  const localType = resolveLocalTypeInfo(resolvedTarget, context)?.info;
  if (localType?.kind !== "class" && localType?.kind !== "interface") {
    return undefined;
  }

  return findMethodSurface(
    localType.members,
    memberName,
    localType.typeParameters,
    resolvedTarget.typeArguments
  );
};
