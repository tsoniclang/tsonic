/**
 * Call-site analysis — Type template unification & substitution
 *
 * Type template unification, expected-return derivation, and type parameter
 * substitution for call/new expression converters. Split from
 * call-site-analysis.ts for file-size compliance.
 */

import { IrType } from "../../../types.js";
import {
  irTypesEqual,
  referenceTypeIdentity,
} from "../../../types/type-ops.js";

export type CallSiteArgModifier = "ref" | "out" | "in";

export const unifyTypeTemplate = (
  template: IrType,
  actual: IrType,
  substitutions: Map<string, IrType>
): boolean => {
  if (template.kind === "typeParameterType") {
    const existing = substitutions.get(template.name);
    if (!existing) {
      substitutions.set(template.name, actual);
      return true;
    }
    return irTypesEqual(existing, actual);
  }

  if (template.kind !== actual.kind) return false;

  switch (template.kind) {
    case "primitiveType":
      return template.name === (actual as typeof template).name;
    case "literalType":
      return template.value === (actual as typeof template).value;
    case "voidType":
    case "unknownType":
    case "anyType":
    case "neverType":
      return true;
    case "arrayType":
      return unifyTypeTemplate(
        template.elementType,
        (actual as typeof template).elementType,
        substitutions
      );
    case "tupleType": {
      const rhs = actual as typeof template;
      if (template.elementTypes.length !== rhs.elementTypes.length)
        return false;
      return template.elementTypes.every((t, i) => {
        const other = rhs.elementTypes[i];
        return other ? unifyTypeTemplate(t, other, substitutions) : false;
      });
    }
    case "dictionaryType":
      return (
        unifyTypeTemplate(
          template.keyType,
          (actual as typeof template).keyType,
          substitutions
        ) &&
        unifyTypeTemplate(
          template.valueType,
          (actual as typeof template).valueType,
          substitutions
        )
      );
    case "referenceType": {
      const rhs = actual as typeof template;
      if (referenceTypeIdentity(template) !== referenceTypeIdentity(rhs))
        return false;
      const templateArgs = template.typeArguments ?? [];
      const actualArgs = rhs.typeArguments ?? [];
      if (templateArgs.length !== actualArgs.length) return false;
      return templateArgs.every((t, i) => {
        const other = actualArgs[i];
        return other ? unifyTypeTemplate(t, other, substitutions) : false;
      });
    }
    case "unionType":
    case "intersectionType": {
      const rhs = actual as typeof template;
      if (template.types.length !== rhs.types.length) return false;
      return template.types.every((t, i) => {
        const other = rhs.types[i];
        return other ? unifyTypeTemplate(t, other, substitutions) : false;
      });
    }
    case "functionType": {
      const rhs = actual as typeof template;
      if (template.parameters.length !== rhs.parameters.length) return false;
      const paramsMatch = template.parameters.every((p, i) => {
        const other = rhs.parameters[i];
        if (
          !other ||
          p.isRest !== other.isRest ||
          p.isOptional !== other.isOptional
        )
          return false;
        if (!p.type || !other.type) return p.type === other.type;
        return unifyTypeTemplate(p.type, other.type, substitutions);
      });
      return (
        paramsMatch &&
        unifyTypeTemplate(template.returnType, rhs.returnType, substitutions)
      );
    }
    case "objectType": {
      const rhs = actual as typeof template;
      if (template.members.length !== rhs.members.length) return false;
      return template.members.every((m, i) => {
        const other = rhs.members[i];
        if (!other || m.kind !== other.kind || m.name !== other.name) {
          return false;
        }
        if (m.kind === "propertySignature") {
          return (
            other.kind === "propertySignature" &&
            m.isOptional === other.isOptional &&
            m.isReadonly === other.isReadonly &&
            unifyTypeTemplate(m.type, other.type, substitutions)
          );
        }
        if (other.kind !== "methodSignature") return false;
        if (
          (m.typeParameters?.length ?? 0) !==
          (other.typeParameters?.length ?? 0)
        )
          return false;
        if (m.parameters.length !== other.parameters.length) return false;
        const paramsMatch = m.parameters.every((p, paramIndex) => {
          const otherParam = other.parameters[paramIndex];
          if (!otherParam) return false;
          if (
            p.isRest !== otherParam.isRest ||
            p.isOptional !== otherParam.isOptional ||
            p.passing !== otherParam.passing
          ) {
            return false;
          }
          if (!p.type || !otherParam.type) return p.type === otherParam.type;
          return unifyTypeTemplate(p.type, otherParam.type, substitutions);
        });
        if (!paramsMatch) return false;
        if (!m.returnType || !other.returnType) {
          return m.returnType === other.returnType;
        }
        return unifyTypeTemplate(m.returnType, other.returnType, substitutions);
      });
    }
  }
};

export const deriveSubstitutionsFromExpectedReturn = (
  returnTemplate: IrType | undefined,
  expectedCandidates: readonly IrType[] | undefined
): Map<string, IrType> | undefined => {
  if (
    !returnTemplate ||
    !expectedCandidates ||
    expectedCandidates.length === 0
  ) {
    return undefined;
  }

  let matched: Map<string, IrType> | undefined;
  for (const candidate of expectedCandidates) {
    const attempt = new Map<string, IrType>();
    if (!unifyTypeTemplate(returnTemplate, candidate, attempt)) continue;
    if (attempt.size === 0) continue;
    if (matched) {
      return undefined;
    }
    matched = attempt;
  }

  return matched;
};

/** Substitute with non-undefined input guaranteed to produce non-undefined output. */
const substituteRequired = (
  type: IrType,
  substitutions: ReadonlyMap<string, IrType>
): IrType => substituteTypeParameters(type, substitutions) ?? type;

export const substituteTypeParameters = (
  type: IrType | undefined,
  substitutions: ReadonlyMap<string, IrType>
): IrType | undefined => {
  if (!type) return undefined;

  switch (type.kind) {
    case "typeParameterType":
      return substitutions.get(type.name) ?? type;
    case "arrayType":
      return {
        ...type,
        elementType: substituteRequired(type.elementType, substitutions),
      };
    case "tupleType":
      return {
        ...type,
        elementTypes: type.elementTypes.map((t) =>
          substituteRequired(t, substitutions)
        ),
      };
    case "dictionaryType":
      return {
        ...type,
        keyType: substituteRequired(type.keyType, substitutions),
        valueType: substituteRequired(type.valueType, substitutions),
      };
    case "referenceType":
      return {
        ...type,
        ...(type.typeArguments
          ? {
              typeArguments: type.typeArguments.map((t) =>
                substituteRequired(t, substitutions)
              ),
            }
          : {}),
      };
    case "unionType":
    case "intersectionType":
      return {
        ...type,
        types: type.types.map((t) => substituteRequired(t, substitutions)),
      };
    case "functionType":
      return {
        ...type,
        parameters: type.parameters.map((p) => ({
          ...p,
          type: substituteTypeParameters(p.type, substitutions),
        })),
        returnType: substituteRequired(type.returnType, substitutions),
      };
    case "objectType":
      return {
        ...type,
        members: type.members.map((m) => {
          if (m.kind === "propertySignature") {
            return {
              ...m,
              type: substituteRequired(m.type, substitutions),
            };
          }
          return {
            ...m,
            typeParameters: m.typeParameters?.map((tp) => ({
              ...tp,
              constraint: substituteTypeParameters(
                tp.constraint,
                substitutions
              ),
              default: substituteTypeParameters(tp.default, substitutions),
            })),
            parameters: m.parameters.map((p) => ({
              ...p,
              type: substituteTypeParameters(p.type, substitutions),
            })),
            returnType: substituteTypeParameters(m.returnType, substitutions),
          };
        }),
      };
    default:
      return type;
  }
};
