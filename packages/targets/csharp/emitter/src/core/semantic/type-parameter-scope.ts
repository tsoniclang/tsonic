import type { IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";

export const isTypeParameterInCurrentScope = (
  name: string,
  context: EmitterContext
): boolean =>
  context.typeParameters?.has(name) === true ||
  context.typeParamConstraints?.has(name) === true ||
  context.typeParameterNameMap?.has(name) === true ||
  context.declaringTypeParameterNameMap?.has(name) === true ||
  context.declaringTypeParameterNames?.includes(name) === true;

export const containsOutOfScopeTypeParameter = (
  type: IrType | undefined,
  context: EmitterContext,
  visitedTypes: WeakSet<object> = new WeakSet()
): boolean => {
  if (!type) {
    return false;
  }
  if (visitedTypes.has(type)) {
    return false;
  }
  visitedTypes.add(type);

  switch (type.kind) {
    case "typeParameterType":
      return !isTypeParameterInCurrentScope(type.name, context);
    case "referenceType":
      if (
        !type.externalQualifiedName &&
        !type.typeId &&
        !type.structuralMembers?.length &&
        !isTypeParameterInCurrentScope(type.name, context) &&
        !(context.localTypes?.has(type.name) ?? false) &&
        !(context.bindingsRegistry?.has(type.name) ?? false) &&
        !context.bindingRegistry?.getType(type.name)
      ) {
        return true;
      }
      return (
        type.typeArguments?.some((argument) =>
          containsOutOfScopeTypeParameter(argument, context, visitedTypes)
        ) ?? false
      );
    case "arrayType":
      return containsOutOfScopeTypeParameter(
        type.elementType,
        context,
        visitedTypes
      );
    case "dictionaryType":
      return (
        containsOutOfScopeTypeParameter(
          type.keyType,
          context,
          visitedTypes
        ) ||
        containsOutOfScopeTypeParameter(
          type.valueType,
          context,
          visitedTypes
        )
      );
    case "tupleType":
      return type.elementTypes.some((elementType) =>
        containsOutOfScopeTypeParameter(elementType, context, visitedTypes)
      );
    case "functionType":
      return (
        type.parameters.some((parameter) =>
          containsOutOfScopeTypeParameter(
            parameter.type,
            context,
            visitedTypes
          )
        ) ||
        containsOutOfScopeTypeParameter(
          type.returnType,
          context,
          visitedTypes
        )
      );
    case "unionType":
    case "intersectionType":
      return type.types.some((member) =>
        containsOutOfScopeTypeParameter(member, context, visitedTypes)
      );
    case "objectType":
      return type.members.some((member) =>
        member.kind === "propertySignature"
          ? containsOutOfScopeTypeParameter(
              member.type,
              context,
              visitedTypes
            )
          : containsOutOfScopeTypeParameter(
              member.returnType,
              context,
              visitedTypes
            ) ||
            member.parameters.some((parameter) =>
              containsOutOfScopeTypeParameter(
                parameter.type,
                context,
                visitedTypes
              )
            )
      );
    default:
      return false;
  }
};

export const containsTypeParameter = (
  type: IrType | undefined,
  visitedTypes: WeakSet<object> = new WeakSet()
): boolean => {
  if (!type) {
    return false;
  }
  if (visitedTypes.has(type)) {
    return false;
  }
  visitedTypes.add(type);

  switch (type.kind) {
    case "typeParameterType":
      return true;
    case "referenceType":
      return (
        type.typeArguments?.some((typeArgument) =>
          containsTypeParameter(typeArgument, visitedTypes)
        ) ?? false
      );
    case "arrayType":
      return containsTypeParameter(type.elementType, visitedTypes);
    case "dictionaryType":
      return (
        containsTypeParameter(type.keyType, visitedTypes) ||
        containsTypeParameter(type.valueType, visitedTypes)
      );
    case "tupleType":
      return type.elementTypes.some((elementType) =>
        containsTypeParameter(elementType, visitedTypes)
      );
    case "functionType":
      return (
        type.parameters.some((parameter) =>
          containsTypeParameter(parameter.type, visitedTypes)
        ) || containsTypeParameter(type.returnType, visitedTypes)
      );
    case "unionType":
    case "intersectionType":
      return type.types.some((member) =>
        containsTypeParameter(member, visitedTypes)
      );
    default:
      return false;
  }
};

export const preferInferredTypeOverOutOfScopeGenericType = (
  candidateType: IrType | undefined,
  inferredType: IrType | undefined,
  context: EmitterContext
): IrType | undefined => {
  if (
    candidateType &&
    inferredType &&
    (containsOutOfScopeTypeParameter(candidateType, context) ||
      (containsTypeParameter(candidateType) &&
        !containsTypeParameter(inferredType))) &&
    !containsOutOfScopeTypeParameter(inferredType, context)
  ) {
    return inferredType;
  }

  return candidateType ?? inferredType;
};
