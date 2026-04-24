/**
 * Anonymous Type Template Inference & Carrier Reuse
 *
 * Template argument inference for matching object types against existing
 * structural carriers, and object type reference creation/reuse logic.
 */

import type { IrType, IrObjectType, IrReferenceType } from "../types.js";
import { referenceTypeIdentity } from "../types/type-ops.js";

import {
  collectTypeParameterNames,
  computeShapeSignature,
  serializeType,
} from "./anon-type-shape-analysis.js";

import type { LoweringContext } from "./anon-type-ir-rewriting.js";

import {
  isReusableStructuralCarrierName,
  getOrCreateTypeName,
} from "./anon-type-naming.js";

export const inferTemplateTypeArguments = (
  template: IrType,
  concrete: IrType,
  substitution: Map<string, IrType>
): boolean => {
  if (template.kind === "typeParameterType") {
    const existing = substitution.get(template.name);
    if (!existing) {
      substitution.set(template.name, concrete);
      return true;
    }
    return serializeType(existing) === serializeType(concrete);
  }

  if (template.kind !== concrete.kind) {
    return false;
  }

  switch (template.kind) {
    case "primitiveType":
      return (
        concrete.kind === "primitiveType" && template.name === concrete.name
      );
    case "literalType":
      return (
        concrete.kind === "literalType" && template.value === concrete.value
      );
    case "voidType":
    case "unknownType":
    case "anyType":
    case "neverType":
      return true;
    case "referenceType": {
      if (concrete.kind !== "referenceType") {
        return false;
      }
      const templateIdentity = referenceTypeIdentity(template);
      const concreteIdentity = referenceTypeIdentity(concrete);
      if (
        templateIdentity === undefined ||
        concreteIdentity === undefined ||
        templateIdentity !== concreteIdentity
      ) {
        return false;
      }
      const templateArgs = template.typeArguments ?? [];
      const concreteArgs = concrete.typeArguments ?? [];
      if (templateArgs.length !== concreteArgs.length) {
        return false;
      }
      for (let index = 0; index < templateArgs.length; index += 1) {
        const templateArg = templateArgs[index];
        const concreteArg = concreteArgs[index];
        if (!templateArg || !concreteArg) {
          return false;
        }
        if (
          !inferTemplateTypeArguments(templateArg, concreteArg, substitution)
        ) {
          return false;
        }
      }
      return true;
    }
    case "arrayType":
      if (concrete.kind !== "arrayType") {
        return false;
      }
      return inferTemplateTypeArguments(
        template.elementType,
        concrete.elementType,
        substitution
      );
    case "tupleType":
      if (concrete.kind !== "tupleType") {
        return false;
      }
      if (template.elementTypes.length !== concrete.elementTypes.length) {
        return false;
      }
      for (let index = 0; index < template.elementTypes.length; index += 1) {
        const templateElement = template.elementTypes[index];
        const concreteElement = concrete.elementTypes[index];
        if (!templateElement || !concreteElement) {
          return false;
        }
        if (
          !inferTemplateTypeArguments(
            templateElement,
            concreteElement,
            substitution
          )
        ) {
          return false;
        }
      }
      return true;
    case "unionType":
    case "intersectionType":
      if (concrete.kind !== template.kind) {
        return false;
      }
      if (template.types.length !== concrete.types.length) {
        return false;
      }
      for (let index = 0; index < template.types.length; index += 1) {
        const templateMember = template.types[index];
        const concreteMember = concrete.types[index];
        if (!templateMember || !concreteMember) {
          return false;
        }
        if (
          !inferTemplateTypeArguments(
            templateMember,
            concreteMember,
            substitution
          )
        ) {
          return false;
        }
      }
      return true;
    case "functionType":
      if (concrete.kind !== "functionType") {
        return false;
      }
      if (template.parameters.length !== concrete.parameters.length) {
        return false;
      }
      for (let index = 0; index < template.parameters.length; index += 1) {
        const templateParam = template.parameters[index];
        const concreteParam = concrete.parameters[index];
        if (!templateParam || !concreteParam) {
          return false;
        }
        if (
          templateParam.isOptional !== concreteParam.isOptional ||
          templateParam.isRest !== concreteParam.isRest ||
          templateParam.passing !== concreteParam.passing
        ) {
          return false;
        }
        if (templateParam.type && concreteParam.type) {
          if (
            !inferTemplateTypeArguments(
              templateParam.type,
              concreteParam.type,
              substitution
            )
          ) {
            return false;
          }
        } else if (templateParam.type || concreteParam.type) {
          return false;
        }
      }
      return inferTemplateTypeArguments(
        template.returnType,
        concrete.returnType,
        substitution
      );
    case "objectType":
      if (concrete.kind !== "objectType") {
        return false;
      }
      if (template.members.length !== concrete.members.length) {
        return false;
      }
      for (let index = 0; index < template.members.length; index += 1) {
        const templateMember = template.members[index];
        const concreteMember = concrete.members[index];
        if (!templateMember || !concreteMember) {
          return false;
        }
        if (
          templateMember.kind !== concreteMember.kind ||
          templateMember.name !== concreteMember.name
        ) {
          return false;
        }
        if (
          templateMember.kind === "propertySignature" &&
          concreteMember.kind === "propertySignature"
        ) {
          if (
            templateMember.isOptional !== concreteMember.isOptional ||
            templateMember.isReadonly !== concreteMember.isReadonly
          ) {
            return false;
          }
          if (
            !inferTemplateTypeArguments(
              templateMember.type,
              concreteMember.type,
              substitution
            )
          ) {
            return false;
          }
          continue;
        }
        if (
          templateMember.kind !== "methodSignature" ||
          concreteMember.kind !== "methodSignature"
        ) {
          return false;
        }
        if (
          templateMember.parameters.length !== concreteMember.parameters.length
        ) {
          return false;
        }
        for (
          let paramIndex = 0;
          paramIndex < templateMember.parameters.length;
          paramIndex += 1
        ) {
          const templateParam = templateMember.parameters[paramIndex];
          const concreteParam = concreteMember.parameters[paramIndex];
          if (!templateParam || !concreteParam) {
            return false;
          }
          if (
            templateParam.isOptional !== concreteParam.isOptional ||
            templateParam.isRest !== concreteParam.isRest ||
            templateParam.passing !== concreteParam.passing
          ) {
            return false;
          }
          if (templateParam.type && concreteParam.type) {
            if (
              !inferTemplateTypeArguments(
                templateParam.type,
                concreteParam.type,
                substitution
              )
            ) {
              return false;
            }
          } else if (templateParam.type || concreteParam.type) {
            return false;
          }
        }
        if (templateMember.returnType && concreteMember.returnType) {
          if (
            !inferTemplateTypeArguments(
              templateMember.returnType,
              concreteMember.returnType,
              substitution
            )
          ) {
            return false;
          }
        } else if (templateMember.returnType || concreteMember.returnType) {
          return false;
        }
      }
      return true;
    case "dictionaryType":
      if (concrete.kind !== "dictionaryType") {
        return false;
      }
      return (
        inferTemplateTypeArguments(
          template.keyType,
          concrete.keyType,
          substitution
        ) &&
        inferTemplateTypeArguments(
          template.valueType,
          concrete.valueType,
          substitution
        )
      );
    default:
      return false;
  }
};

export const tryInstantiateReusableStructuralCarrier = (
  objectType: IrObjectType,
  ctx: LoweringContext
): IrReferenceType | undefined => {
  for (const templateRef of ctx.shapeToExistingReference.values()) {
    if (!isReusableStructuralCarrierName(templateRef.name)) {
      continue;
    }

    const templateMembers = templateRef.structuralMembers;
    if (!templateMembers || templateMembers.length === 0) {
      continue;
    }

    const substitution = new Map<string, IrType>();
    const matches = inferTemplateTypeArguments(
      { kind: "objectType", members: templateMembers },
      objectType,
      substitution
    );
    if (!matches) {
      continue;
    }

    const templateTypeArgs = templateRef.typeArguments ?? [];
    const instantiatedTypeArgs: IrType[] = [];
    for (const typeArg of templateTypeArgs) {
      if (typeArg.kind !== "typeParameterType") {
        instantiatedTypeArgs.push(typeArg);
        continue;
      }
      const resolved = substitution.get(typeArg.name);
      if (!resolved) {
        instantiatedTypeArgs.length = 0;
        break;
      }
      instantiatedTypeArgs.push(resolved);
    }
    if (templateTypeArgs.length > 0 && instantiatedTypeArgs.length === 0) {
      continue;
    }

    return {
      ...templateRef,
      typeArguments:
        instantiatedTypeArgs.length > 0 ? instantiatedTypeArgs : undefined,
      structuralMembers: objectType.members,
    };
  }

  return undefined;
};

export const getOrCreateObjectTypeReference = (
  objectType: IrObjectType,
  ctx: LoweringContext
): IrReferenceType => {
  const signature = computeShapeSignature(objectType);
  const existingReference = ctx.shapeToExistingReference.get(signature);
  const typeParamNames = new Set<string>();
  for (const member of objectType.members) {
    if (member.kind === "propertySignature") {
      collectTypeParameterNames(member.type, typeParamNames);
    } else if (member.kind === "methodSignature") {
      for (const p of member.parameters) {
        if (p.type) collectTypeParameterNames(p.type, typeParamNames);
      }
      if (member.returnType) {
        collectTypeParameterNames(member.returnType, typeParamNames);
      }
    }
  }
  const orderedTypeParams = Array.from(typeParamNames).sort();

  if (existingReference) {
    return {
      ...existingReference,
      typeArguments:
        existingReference.typeArguments &&
        existingReference.typeArguments.length > 0
          ? existingReference.typeArguments
          : orderedTypeParams.length > 0
            ? orderedTypeParams.map(
                (tp): IrType => ({
                  kind: "typeParameterType",
                  name: tp,
                })
              )
            : undefined,
      structuralMembers: objectType.members,
    };
  }

  const reusableCarrier = tryInstantiateReusableStructuralCarrier(
    objectType,
    ctx
  );
  if (reusableCarrier) {
    return reusableCarrier;
  }

  const typeName = getOrCreateTypeName(objectType, ctx);
  return {
    kind: "referenceType",
    name: typeName,
    typeArguments:
      orderedTypeParams.length > 0
        ? orderedTypeParams.map(
            (tp): IrType => ({
              kind: "typeParameterType",
              name: tp,
            })
          )
        : undefined,
    resolvedClrType: undefined,
    structuralMembers: objectType.members,
  };
};
