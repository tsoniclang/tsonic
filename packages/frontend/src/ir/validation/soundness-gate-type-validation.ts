import { isKnownBuiltinReferenceType } from "./known-builtin-reference-types.js";
import {
  createUnsupportedCapabilityDiagnostic,
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
  shouldReportUnsupportedCapability,
} from "./soundness-gate-shared.js";
import { validateExpression } from "./soundness-gate-expression-validation.js";

type UnknownRootKind = "expressionInferredType";
type ObjectRootKind = "runtimeStorage" | "semanticMetadata";
type IntersectionRootKind =
  | "runtimeStorage"
  | "typeParameterConstraint"
  | "semanticMetadata";

const parameterPassingCapabilities = {
  out: "out-parameters",
  ref: "ref-parameters",
  in: "in-parameters",
} as const;

const isArrayLikeStorageType = (type: IrType): boolean =>
  type.kind === "arrayType" ||
  (type.kind === "referenceType" &&
    (type.name === "Array" ||
      type.name === "ReadonlyArray" ||
      type.name === "ArrayLike") &&
    (type.typeArguments?.length ?? 0) === 1);

const isPropertyOnlyObjectType = (type: IrType): boolean =>
  type.kind === "objectType" &&
  type.members.every((member) => member.kind === "propertySignature");

const isPropertyOnlyStructuralReferenceType = (type: IrType): boolean =>
  type.kind === "referenceType" &&
  (type.structuralMembers?.length ?? 0) > 0 &&
  type.structuralMembers!.every(
    (member) => member.kind === "propertySignature"
  );

const isArrayOverlayIntersectionType = (
  type: Extract<IrType, { kind: "intersectionType" }>
): boolean => {
  let carrierCount = 0;
  let propertyOverlayCount = 0;
  const visit = (member: IrType): boolean => {
    if (member.kind === "intersectionType") {
      return member.types.every(visit);
    }
    if (isArrayLikeStorageType(member)) {
      carrierCount += 1;
      return true;
    }
    if (isPropertyOnlyObjectType(member)) {
      propertyOverlayCount += 1;
      return true;
    }
    if (isPropertyOnlyStructuralReferenceType(member)) {
      propertyOverlayCount += 1;
      return true;
    }
    return false;
  };

  return (
    type.types.every(visit) &&
    carrierCount === 1 &&
    propertyOverlayCount > 0
  );
};

export const validateType = (
  type: IrType | undefined,
  ctx: ValidationContext,
  typeContext: string,
  options: {
    readonly unknownRootKind?: UnknownRootKind;
    readonly objectRootKind?: ObjectRootKind;
    readonly intersectionRootKind?: IntersectionRootKind;
  } = {}
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
        if (ctx.validationMode !== "capability") {
          ctx.diagnostics.push(
            createDiagnostic(
              "TSN7414",
              "error",
              `Type cannot be represented in compiler subset: ${typeContext}. The type resolved to 'any' which is not supported.`,
              moduleLocation(ctx),
              "Ensure the type can be explicitly annotated or is a recognized type alias."
            )
          );
        }
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
        type.parameters.forEach((parameter) =>
          validateParameter(parameter, ctx)
        );
        validateType(type.returnType, ctx, `${typeContext} return type`);
        break;

      case "objectType":
        if (
          ctx.validationMode !== "capability" &&
          (options.objectRootKind ?? "runtimeStorage") === "runtimeStorage"
        ) {
          ctx.diagnostics.push(
            createDiagnostic(
              "TSN7421",
              "error",
              `Anonymous object type in ${typeContext} was not lowered to a named type. This is an internal compiler error.`,
              moduleLocation(ctx),
              "Please report this issue with a minimal reproduction."
            )
          );
        }
        type.members.forEach((member) => validateInterfaceMember(member, ctx));
        break;

      case "dictionaryType":
        if (
          type.keyType.kind === "neverType" ||
          type.valueType.kind === "neverType"
        ) {
          if (ctx.validationMode !== "capability") {
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
        const isArrayOverlayIntersection =
          isArrayOverlayIntersectionType(type);
        if (
          !isArrayOverlayIntersection &&
          shouldReportUnsupportedCapability(
            ctx,
            "intersection-value-storage"
          ) &&
          (options.intersectionRootKind ?? "runtimeStorage") ===
            "runtimeStorage"
        ) {
          ctx.diagnostics.push(
            createUnsupportedCapabilityDiagnostic(
              ctx,
              "intersection-value-storage",
              "TSN7414",
              `Intersection type in ${typeContext} cannot be emitted as a runtime storage type.`,
              "Use a named interface/class that represents the required runtime shape, or keep the intersection only as a generic constraint."
            )
          );
        }
        type.types.forEach((member, index) =>
          validateType(
            member,
            ctx,
            `${typeContext} intersection member ${index}`,
            isArrayOverlayIntersection
              ? {
                  ...options,
                  objectRootKind: "semanticMetadata",
                  intersectionRootKind: "semanticMetadata",
                }
              : options
          )
        );
        break;

      case "referenceType": {
        const { name, providerQualifiedName, typeId } = type;
        if (
          type.structuralMembers !== undefined &&
          type.structuralMembers.length > 0 &&
          type.structuralOrigin === undefined
        ) {
          if (ctx.validationMode !== "capability") {
            ctx.diagnostics.push(
              createDiagnostic(
                "TSN7414",
                "error",
                `Reference type '${name}' in ${typeContext} has structural members without structural-origin metadata.`,
                moduleLocation(ctx),
                "Preserve whether the source used a named reference or a compiler-owned structural carrier before the soundness gate."
              )
            );
          }
        }
        const sameNamespaceName =
          ctx.namespace.length > 0 && name.startsWith(`${ctx.namespace}.`)
            ? name.slice(ctx.namespace.length + 1)
            : undefined;
        const candidateNames = [
          ...getReferenceResolutionCandidates(name),
          ...(sameNamespaceName
            ? getReferenceResolutionCandidates(sameNamespaceName)
            : []),
        ];
        const isResolvable =
          typeId !== undefined ||
          providerQualifiedName !== undefined ||
          (type.structuralMembers !== undefined &&
            type.structuralMembers.length > 0) ||
          candidateNames.some(
            (candidate) =>
              KNOWN_BUILTINS.has(candidate) ||
              isKnownBuiltinReferenceType(candidate)
          ) ||
          candidateNames.some((candidate) =>
            ctx.localTypeNames.has(candidate)
          ) ||
          candidateNames.some((candidate) =>
            ctx.namespaceLocalTypeNames.has(candidate)
          ) ||
          candidateNames.some((candidate) =>
            ctx.importedTypeNames.has(candidate)
          ) ||
          candidateNames.some((candidate) =>
            ctx.knownReferenceTypes.has(candidate)
          ) ||
          candidateNames.some((candidate) =>
            ctx.typeParameterNames.has(candidate)
          );

        const referencedAlias = candidateNames
          .map(
            (candidate) =>
              ctx.localTypeAliases.get(candidate) ??
              ctx.namespaceTypeAliases.get(candidate)
          )
          .find((alias) => alias !== undefined);
        if (referencedAlias) {
          validateType(
            referencedAlias.type,
            ctx,
            `type alias '${referencedAlias.name}'`,
            {
              objectRootKind: "semanticMetadata",
              intersectionRootKind: "semanticMetadata",
            }
          );
        }

        if (!isResolvable) {
          if (ctx.validationMode !== "capability") {
            ctx.diagnostics.push(
              createDiagnostic(
                "TSN7414",
                "error",
                `Unresolved reference type '${name}' in ${typeContext}. The type is not local, not imported, and has no native target binding.`,
                moduleLocation(ctx),
                "Ensure the type is imported or defined locally, or that external bindings are available."
              )
            );
          }
        }

        type.typeArguments?.forEach((typeArgument, index) => {
          if (typeArgument.kind === "neverType") {
            if (ctx.validationMode !== "capability") {
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
          }
          validateType(typeArgument, ctx, `${typeContext}<arg ${index}>`);
        });
        break;
      }

      case "primitiveType":
        if (
          type.name === "bigint" &&
          shouldReportUnsupportedCapability(ctx, "bigint")
        ) {
          ctx.diagnostics.push(
            createUnsupportedCapabilityDiagnostic(
              ctx,
              "bigint",
              "TSN5001",
              `bigint in ${typeContext} is not supported by the active backend.`,
              "Use a backend that declares bigint support, or rewrite this type to a supported numeric abstraction."
            )
          );
        }
        break;
      case "typeParameterType":
      case "literalType":
      case "voidType":
      case "neverType":
        break;

      case "unknownType":
        if (
          type.explicit === true ||
          options.unknownRootKind === "expressionInferredType"
        ) {
          break;
        }
        if (ctx.validationMode !== "capability") {
          ctx.diagnostics.push(
            createDiagnostic(
              "TSN7414",
              "error",
              `Type cannot be represented in compiler subset: ${typeContext}. The type resolved to 'unknown' which must have been eliminated before emission.`,
              moduleLocation(ctx),
              "Replace explicit 'unknown' with a concrete type, and ensure unresolved placeholder types are eliminated before the soundness gate."
            )
          );
        }
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
  if (parameter.passing !== "value") {
    const capabilityName = parameterPassingCapabilities[parameter.passing];
    if (shouldReportUnsupportedCapability(ctx, capabilityName)) {
      ctx.diagnostics.push(
        createUnsupportedCapabilityDiagnostic(
          ctx,
          capabilityName,
          "TSN5001",
          `Parameter '${paramName}' uses ${parameter.passing} passing, which is not supported by the active backend.`,
          `Use a backend that declares ${parameter.passing} parameter support, or rewrite the API to return an explicit value.`
        )
      );
    }
  }
  if (
    parameter.attributes !== undefined &&
    parameter.attributes.length > 0 &&
    shouldReportUnsupportedCapability(ctx, "parameter-decorators")
  ) {
    ctx.diagnostics.push(
      createUnsupportedCapabilityDiagnostic(
        ctx,
        "parameter-decorators",
        "TSN5001",
        `Parameter '${paramName}' has metadata attributes, which are not supported by the active backend.`,
        "Use a backend that declares parameter metadata-attribute support, or remove the parameter attributes."
      )
    );
  }
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
    `type parameter '${typeParameter.name}' constraint`,
    { intersectionRootKind: "typeParameterConstraint" }
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
      member.parameters.forEach((parameter) =>
        validateParameter(parameter, ctx)
      );
      validateType(
        member.returnType,
        ctx,
        `method '${member.name}' return type`
      );
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
