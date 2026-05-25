import { IrType } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";

export const containsOutOfScopeTypeParameter = (
  type: IrType,
  context: EmitterContext,
  visited = new Set<IrType>()
): boolean => {
  if (visited.has(type)) {
    return false;
  }
  visited.add(type);

  switch (type.kind) {
    case "typeParameterType":
      return !(context.typeParameters?.has(type.name) ?? false);
    case "arrayType":
      return containsOutOfScopeTypeParameter(
        type.elementType,
        context,
        visited
      );
    case "dictionaryType":
      return (
        containsOutOfScopeTypeParameter(type.keyType, context, visited) ||
        containsOutOfScopeTypeParameter(type.valueType, context, visited)
      );
    case "tupleType":
      return type.elementTypes.some((elementType) =>
        containsOutOfScopeTypeParameter(elementType, context, visited)
      );
    case "functionType":
      return (
        type.parameters.some((parameter) =>
          parameter.type
            ? containsOutOfScopeTypeParameter(parameter.type, context, visited)
            : false
        ) || containsOutOfScopeTypeParameter(type.returnType, context, visited)
      );
    case "referenceType":
      return (type.typeArguments ?? []).some((typeArgument) =>
        containsOutOfScopeTypeParameter(typeArgument, context, visited)
      );
    case "unionType":
      return type.types.some((member) =>
        containsOutOfScopeTypeParameter(member, context, visited)
      );
    case "intersectionType":
      return type.types.some((member) =>
        containsOutOfScopeTypeParameter(member, context, visited)
      );
    case "objectType":
      return type.members.some((member) =>
        member.kind === "propertySignature"
          ? member.type
            ? containsOutOfScopeTypeParameter(member.type, context, visited)
            : false
          : (member.returnType
              ? containsOutOfScopeTypeParameter(
                  member.returnType,
                  context,
                  visited
                )
              : false) ||
            member.parameters.some((parameter) =>
              parameter.type
                ? containsOutOfScopeTypeParameter(
                    parameter.type,
                    context,
                    visited
                  )
                : false
            )
      );
    default:
      return false;
  }
};

export const typeArgumentsAreInScope = (
  typeArguments: readonly IrType[] | undefined,
  context: EmitterContext
): boolean =>
  !typeArguments ||
  !typeArguments.some((typeArgument) =>
    containsOutOfScopeTypeParameter(typeArgument, context)
  );
