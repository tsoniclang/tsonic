import { isKnownBuiltinReferenceType } from "./known-builtin-reference-types.js";
import {
  createDiagnostic,
  getReferenceResolutionCandidates,
  KNOWN_BUILTINS,
  moduleLocation,
  type IrInterfaceMember,
  type IrParameter,
  type IrPattern,
  type IrType,
  type IrTypeParameter,
  type ValidationContext,
} from "./soundness-gate-shared.js";
import { validateExpression } from "./soundness-gate-expression-validation.js";

export const validateType = (
  type: IrType | undefined,
  ctx: ValidationContext,
  typeContext: string
): void => {
  if (!type) return;
  if (typeof type === "object" && type !== null) {
    if (ctx.activeTypeValidation.has(type)) {
      return;
    }
    ctx.activeTypeValidation.add(type);
  }

  try {
    switch (type.kind) {
      case "anyType": {
        ctx.diagnostics.push(
          createDiagnostic(
            "TSN7414",
            "error",
            `Type cannot be represented in compiler subset: ${typeContext}. The type resolved to 'any' which is not supported.`,
            moduleLocation(ctx),
            "Ensure the type can be explicitly annotated or is a recognized type alias."
          )
        );
        break;
      }

      case "arrayType":
        validateType(type.elementType, ctx, `${typeContext}[]`);
        break;

      case "tupleType":
        type.elementTypes.forEach((elementType, index) =>
          validateType(elementType, ctx, `${typeContext}[${index}]`)
        );
        break;

      case "functionType":
        type.parameters.forEach((parameter) => validateParameter(parameter, ctx));
        validateType(type.returnType, ctx, `${typeContext} return type`);
        break;

      case "objectType":
        ctx.diagnostics.push(
          createDiagnostic(
            "TSN7421",
            "error",
            `Anonymous object type in ${typeContext} was not lowered to a named type. This is an internal compiler error.`,
            moduleLocation(ctx),
            "Please report this issue with a minimal reproduction."
          )
        );
        type.members.forEach((member) => validateInterfaceMember(member, ctx));
        break;

      case "dictionaryType":
        if (
          type.keyType.kind === "neverType" ||
          type.valueType.kind === "neverType"
        ) {
          ctx.diagnostics.push(
            createDiagnostic(
              "TSN7419",
              "error",
              "'never' cannot be used as a generic type argument.",
              moduleLocation(ctx),
              "Rewrite the type to avoid never. For Result-like types, model explicit variants (Ok<T> | Err<E>) and have helpers return the specific variant type."
            )
          );
        }
        validateType(type.keyType, ctx, `${typeContext} key type`);
        validateType(type.valueType, ctx, `${typeContext} value type`);
        break;

      case "unionType":
        type.types.forEach((member, index) =>
          validateType(member, ctx, `${typeContext} union member ${index}`)
        );
        break;

      case "intersectionType":
        type.types.forEach((member, index) =>
          validateType(
            member,
            ctx,
            `${typeContext} intersection member ${index}`
          )
        );
        break;

      case "referenceType": {
        const { name, resolvedClrType, typeId } = type;
        const candidateNames = getReferenceResolutionCandidates(name);
        const isResolvable =
          typeId !== undefined ||
          resolvedClrType !== undefined ||
          (type.structuralMembers !== undefined &&
            type.structuralMembers.length > 0) ||
          candidateNames.some(
            (candidate) =>
              KNOWN_BUILTINS.has(candidate) ||
              isKnownBuiltinReferenceType(candidate)
          ) ||
          candidateNames.some((candidate) => ctx.localTypeNames.has(candidate)) ||
          candidateNames.some((candidate) =>
            ctx.namespaceLocalTypeNames.has(candidate)
          ) ||
          candidateNames.some((candidate) => ctx.importedTypeNames.has(candidate)) ||
          candidateNames.some((candidate) =>
            ctx.knownReferenceTypes.has(candidate)
          ) ||
          candidateNames.some((candidate) => ctx.typeParameterNames.has(candidate));

        if (!isResolvable) {
          ctx.diagnostics.push(
            createDiagnostic(
              "TSN7414",
              "error",
              `Unresolved reference type '${name}' in ${typeContext}. The type is not local, not imported, and has no CLR binding.`,
              moduleLocation(ctx),
              "Ensure the type is imported or defined locally, or that CLR bindings are available."
            )
          );
        }

        type.typeArguments?.forEach((typeArgument, index) => {
          if (typeArgument.kind === "neverType") {
            ctx.diagnostics.push(
              createDiagnostic(
                "TSN7419",
                "error",
                "'never' cannot be used as a generic type argument.",
                moduleLocation(ctx),
                "Rewrite the type to avoid never. For Result-like types, model explicit variants (Ok<T> | Err<E>) and have helpers return the specific variant type."
              )
            );
          }
          validateType(typeArgument, ctx, `${typeContext}<arg ${index}>`);
        });
        break;
      }

      case "primitiveType":
      case "typeParameterType":
      case "literalType":
      case "voidType":
      case "neverType":
      case "unknownType":
        break;
    }
  } finally {
    if (typeof type === "object" && type !== null) {
      ctx.activeTypeValidation.delete(type);
    }
  }
};

export const validateParameter = (
  parameter: IrParameter,
  ctx: ValidationContext
): void => {
  const paramName =
    parameter.pattern.kind === "identifierPattern"
      ? parameter.pattern.name
      : "param";
  validateType(parameter.type, ctx, `parameter '${paramName}'`);
  validatePattern(parameter.pattern, ctx);
  if (parameter.initializer) {
    validateExpression(parameter.initializer, ctx);
  }
};

export const validateTypeParameter = (
  typeParameter: IrTypeParameter,
  ctx: ValidationContext
): void => {
  validateType(
    typeParameter.constraint,
    ctx,
    `type parameter '${typeParameter.name}' constraint`
  );
  validateType(
    typeParameter.default,
    ctx,
    `type parameter '${typeParameter.name}' default`
  );
  typeParameter.structuralMembers?.forEach((member) =>
    validateInterfaceMember(member, ctx)
  );
};

export const validateInterfaceMember = (
  member: IrInterfaceMember,
  ctx: ValidationContext
): void => {
  switch (member.kind) {
    case "propertySignature":
      validateType(member.type, ctx, `property '${member.name}'`);
      break;
    case "methodSignature":
      member.typeParameters?.forEach((typeParameter) =>
        validateTypeParameter(typeParameter, ctx)
      );
      member.parameters.forEach((parameter) => validateParameter(parameter, ctx));
      validateType(member.returnType, ctx, `method '${member.name}' return type`);
      break;
  }
};

export const validatePattern = (
  pattern: IrPattern,
  ctx: ValidationContext
): void => {
  switch (pattern.kind) {
    case "identifierPattern":
      validateType(pattern.type, ctx, `pattern '${pattern.name}'`);
      break;
    case "arrayPattern":
      pattern.elements.forEach((element) => {
        if (element) {
          validatePattern(element.pattern, ctx);
          if (element.defaultExpr) {
            validateExpression(element.defaultExpr, ctx);
          }
        }
      });
      break;
    case "objectPattern":
      pattern.properties.forEach((property) => {
        if (property.kind === "property") {
          validatePattern(property.value, ctx);
          if (property.defaultExpr) {
            validateExpression(property.defaultExpr, ctx);
          }
        } else {
          validatePattern(property.pattern, ctx);
        }
      });
      break;
  }
};
