import type {
  LoweringTypeMemberPlan,
  LoweringTypeParameterConstraintPlan,
  LoweringTypeRefPlan,
} from "@tsonic/frontend";
import type { RenderContext } from "../types.js";
import {
  isRecursiveRuntimeArrayArm,
  renderCSharpType,
  renderNullableCSharpType,
  renderStructuralTypeReference,
  renderTypeMember,
  renderFunctionReturnType,
  renderRequiredCSharpType,
  renderTypeParameters,
  isVoidLikeTypePlan,
  runtimeUnionValueMemberName,
  runtimeUnionCarrierArms,
  structuralMethodStorageMemberName,
  structuralPropertyGetterMemberName,
  structuralPropertySetterMemberName,
  structuralPropertyStorageMemberName,
  structuralTypeName,
  structuralTypeParameterNames,
} from "./types.js";
import { sanitizeIdentifier, sanitizeTypeName } from "./names.js";

type StructuralDeclarationOptions = {
  readonly declarationName?: string;
  readonly typeReference?: string;
};

type StructuralMethodMember = Extract<
  LoweringTypeMemberPlan,
  { readonly kind: "method" }
>;

type StructuralPropertyMember = Extract<
  LoweringTypeMemberPlan,
  { readonly kind: "property" }
>;

const structuralConstraintParts = (
  constraint: LoweringTypeRefPlan | undefined,
  context: RenderContext
): readonly string[] => {
  if (!constraint) return [];
  switch (constraint.kind) {
    case "intrinsic":
      return constraint.name === "object" ? ["class"] : [];
    case "named":
    case "source-primitive":
      return [renderCSharpType(constraint, context)];
    default:
      return [];
  }
};

const renderStructuralWhereClauses = (
  constraints: readonly LoweringTypeParameterConstraintPlan[] | undefined,
  typeParameters: readonly string[],
  context: RenderContext
): string => {
  const declared = new Set(typeParameters);
  const clauses = (constraints ?? [])
    .filter((constraint) => declared.has(constraint.name))
    .map((constraint) => {
      const parts = structuralConstraintParts(constraint.constraint, context);
      if (parts.length === 0) return undefined;
      return `where ${sanitizeTypeName(constraint.name)} : ${parts.join(", ")}`;
    })
    .filter((clause): clause is string => clause !== undefined);
  return clauses.length > 0 ? ` ${clauses.join(" ")}` : "";
};

const structuralMethodDelegateType = (
  member: StructuralMethodMember,
  context: RenderContext
): string | undefined => {
  if (member.typeParameters.length > 0) {
    context.reportUnsupported(
      "generic structural object method",
      "TypeMember",
      member.name
    );
    return undefined;
  }
  const parameterTypes = member.parameters.map((parameter) =>
    renderRequiredCSharpType(
      parameter.type,
      context,
      "structural method parameter type",
      parameter.sourceKindName,
      parameter.sourceText
    )
  );
  if (isVoidLikeTypePlan(member.returnType)) {
    return parameterTypes.length === 0
      ? "global::System.Action"
      : `global::System.Action<${parameterTypes.join(", ")}>`;
  }
  const returnType = renderFunctionReturnType(
    member.returnType,
    false,
    context,
    "TypeMember",
    member.name
  );
  return `global::System.Func<${[...parameterTypes, returnType].join(", ")}>`;
};

const renderStructuralMethodMember = (
  member: StructuralMethodMember,
  context: RenderContext
): readonly string[] => {
  const delegateType = structuralMethodDelegateType(member, context);
  if (!delegateType) return [];
  const storageName = structuralMethodStorageMemberName(member.name);
  const parameters = member.parameters
    .map(
      (parameter) =>
        `${renderRequiredCSharpType(
          parameter.type,
          context,
          "structural method parameter type",
          parameter.sourceKindName,
          parameter.sourceText
        )} ${sanitizeIdentifier(parameter.name)}`
    )
    .join(", ");
  const argumentList = member.parameters
    .map((parameter) => sanitizeIdentifier(parameter.name))
    .join(", ");
  const returnType = renderFunctionReturnType(
    member.returnType,
    false,
    context,
    "TypeMember",
    member.name
  );
  const invocation = `this.${storageName}(${argumentList})`;
  const methodBody = isVoidLikeTypePlan(member.returnType)
    ? `{ ${invocation}; }`
    : `{ return ${invocation}; }`;
  return [
    `    public ${delegateType} ${storageName} { get; set; } = default!;`,
    `    public ${returnType} ${sanitizeIdentifier(member.name)}(${parameters}) ${methodBody}`,
  ];
};

const renderStructuralPropertyMember = (
  member: StructuralPropertyMember,
  context: RenderContext
): readonly string[] => {
  const valueType = renderRequiredCSharpType(
    member.type,
    context,
    "structural property type",
    "TypeMember",
    member.name
  );
  const storageName = structuralPropertyStorageMemberName(member.name);
  const getterName = structuralPropertyGetterMemberName(member.name);
  const setterName = structuralPropertySetterMemberName(member.name);
  const propertyName = sanitizeIdentifier(member.name);
  return [
    "    [global::System.Text.Json.Serialization.JsonIgnore]",
    `    public ${valueType} ${storageName} { get; set; } = default!;`,
    "    [global::System.Text.Json.Serialization.JsonIgnore]",
    `    public global::System.Func<${valueType}>? ${getterName} { get; set; }`,
    "    [global::System.Text.Json.Serialization.JsonIgnore]",
    `    public global::System.Action<${valueType}>? ${setterName} { get; set; }`,
    `    public ${valueType} ${propertyName}`,
    "    {",
    `        get => this.${getterName} != null ? this.${getterName}() : this.${storageName};`,
    `        set { if (this.${setterName} != null) { this.${setterName}(value); } else { this.${storageName} = value; } }`,
    "    }",
  ];
};

const renderStructuralObjectMember = (
  member: LoweringTypeMemberPlan,
  context: RenderContext
): readonly string[] => {
  switch (member.kind) {
    case "property":
      return renderStructuralPropertyMember(member, context);
    case "method":
      return renderStructuralMethodMember(member, context);
    case "index-signature":
      return [`    public ${renderTypeMember(member, context)}`];
  }
};

const substituteStructuralType = (
  type: LoweringTypeRefPlan | undefined,
  substitutions: ReadonlyMap<string, LoweringTypeRefPlan>
): LoweringTypeRefPlan | undefined => {
  if (!type || substitutions.size === 0) return type;
  switch (type.kind) {
    case "named": {
      if (
        type.declarationKind === "type-parameter" &&
        substitutions.has(type.name)
      ) {
        return substitutions.get(type.name);
      }
      return {
        ...type,
        typeArguments: type.typeArguments.map((argument) =>
          substituteStructuralType(argument, substitutions) ?? argument
        ),
        aliasTarget: substituteStructuralType(type.aliasTarget, substitutions),
      };
    }
    case "array":
      return {
        ...type,
        elementType:
          substituteStructuralType(type.elementType, substitutions) ??
          type.elementType,
      };
    case "record":
      return {
        ...type,
        keyType:
          substituteStructuralType(type.keyType, substitutions) ?? type.keyType,
        valueType:
          substituteStructuralType(type.valueType, substitutions) ??
          type.valueType,
      };
    case "tuple":
      return {
        ...type,
        elements: type.elements.map(
          (element) => substituteStructuralType(element, substitutions) ?? element
        ),
      };
    case "union":
    case "intersection":
      return {
        ...type,
        types: type.types.map(
          (member) => substituteStructuralType(member, substitutions) ?? member
        ),
      };
    case "function":
      return {
        ...type,
        parameters: type.parameters.map((parameter) => ({
          ...parameter,
          type: substituteStructuralType(parameter.type, substitutions),
        })),
        returnType: substituteStructuralType(type.returnType, substitutions),
      };
    case "object":
      return {
        ...type,
        members: type.members.map((member) =>
          substituteStructuralMember(member, substitutions)
        ),
      };
    case "predicate":
      return {
        ...type,
        assertedType: substituteStructuralType(
          type.assertedType,
          substitutions
        ),
      };
    default:
      return type;
  }
};

const substituteStructuralMember = (
  member: LoweringTypeMemberPlan,
  substitutions: ReadonlyMap<string, LoweringTypeRefPlan>
): LoweringTypeMemberPlan => {
  switch (member.kind) {
    case "property":
      return {
        ...member,
        type: substituteStructuralType(member.type, substitutions),
      };
    case "method":
      return {
        ...member,
        parameters: member.parameters.map((parameter) => ({
          ...parameter,
          type: substituteStructuralType(parameter.type, substitutions),
        })),
        returnType: substituteStructuralType(member.returnType, substitutions),
      };
    case "index-signature":
      return {
        ...member,
        keyType: substituteStructuralType(member.keyType, substitutions),
        valueType: substituteStructuralType(member.valueType, substitutions),
      };
  }
};

const structuralObjectMembers = (
  type: LoweringTypeRefPlan,
  objectTarget: Extract<LoweringTypeRefPlan, { readonly kind: "object" }>
): readonly LoweringTypeMemberPlan[] => {
  if (type.kind !== "named" || !type.typeParameters?.length) {
    return objectTarget.members;
  }
  const substitutions = new Map<string, LoweringTypeRefPlan>();
  type.typeParameters.forEach((parameter, index) => {
    const argument = type.typeArguments[index];
    if (argument) substitutions.set(parameter, argument);
  });
  return objectTarget.members.map((member) =>
    substituteStructuralMember(member, substitutions)
  );
};

export const renderStructuralTypeDeclaration = (
  type: LoweringTypeRefPlan,
  context: RenderContext,
  options: StructuralDeclarationOptions = {}
): string | undefined => {
  const unionTarget =
    type.kind === "union"
      ? type
      : type.kind === "named" && type.aliasTarget?.kind === "union"
        ? type.aliasTarget
        : undefined;
  if (unionTarget) {
    const arms = runtimeUnionCarrierArms(type, context);
    if (arms.length < 2) return undefined;
    const name = options.declarationName ?? structuralTypeName(type);
    const typeParameterList = renderTypeParameters(
      structuralTypeParameterNames(type)
    );
    const structuralTypeParameters = structuralTypeParameterNames(type);
    const whereClauses = renderStructuralWhereClauses(
      type.kind === "named" ? type.typeParameterConstraints : undefined,
      structuralTypeParameters,
      context
    );
    const typeReference =
      options.typeReference ?? renderStructuralTypeReference(type, context);
    return [
      `public sealed class ${name}${typeParameterList}${whereClauses}`,
      "{",
      "    private readonly object? value;",
      `    private ${name}(object? value)`,
      "    {",
      "        this.value = value;",
      "    }",
      "",
      `    public object? ${runtimeUnionValueMemberName} => this.value;`,
      "",
      ...arms.flatMap((arm, index) => {
        const armNumber = index + 1;
        const recursiveArrayArm = isRecursiveRuntimeArrayArm(
          arm,
          type,
          context
        );
        const runtimeArm = recursiveArrayArm
          ? ({
              kind: "array",
              elementType: type,
              readonly: true,
            } satisfies LoweringTypeRefPlan)
          : arm;
        const armType = renderCSharpType(runtimeArm, context);
        const nullableArmType = renderNullableCSharpType(runtimeArm, context);
        const recursiveArrayValue = recursiveArrayArm
          ? `global::System.Linq.Enumerable.ToArray(global::System.Linq.Enumerable.Select(value, FromValue))`
          : undefined;
        return [
          `    public static ${typeReference} From${armNumber}(${armType} value) => new ${typeReference}(value);`,
          ...(recursiveArrayArm
            ? [
                `    public static ${typeReference} From${armNumber}(object?[] value) => From${armNumber}((${armType})${recursiveArrayValue});`,
                `    public static ${typeReference} From${armNumber}(global::System.Collections.Generic.List<object?> value) => From${armNumber}((${armType})${recursiveArrayValue});`,
              ]
            : []),
          `    public ${nullableArmType} As${armNumber}() => this.value is ${armType} value ? value : default;`,
          "",
        ];
      }),
      `    public static ${typeReference} FromNull() => new ${typeReference}(null);`,
      `    public static ${typeReference} FromValue(object? value)`,
      "    {",
      "        if (value == null) return FromNull();",
      ...arms.flatMap((arm, index) => {
        const armNumber = index + 1;
        const recursiveArrayArm = isRecursiveRuntimeArrayArm(
          arm,
          type,
          context
        );
        const runtimeArm = recursiveArrayArm
          ? ({
              kind: "array",
              elementType: type,
              readonly: true,
            } satisfies LoweringTypeRefPlan)
          : arm;
        const armType = renderCSharpType(runtimeArm, context);
        return [
          ...(recursiveArrayArm
            ? [
                `        if (value is object?[] array${armNumber}) return From${armNumber}(array${armNumber});`,
                `        if (value is global::System.Collections.Generic.List<object?> list${armNumber}) return From${armNumber}(list${armNumber});`,
              ]
            : []),
          `        if (value is ${armType} value${armNumber}) return From${armNumber}(value${armNumber});`,
        ];
      }),
      `        throw new global::System.InvalidCastException("Value cannot be converted to ${name}.");`,
      "    }",
      "    public bool IsNull => this.value == null;",
      "}",
    ].join("\n");
  }
  const objectTarget =
    type.kind === "object"
      ? type
      : type.kind === "named" && type.aliasTarget?.kind === "object"
        ? type.aliasTarget
        : undefined;
  if (!objectTarget) return undefined;
  const name = options.declarationName ?? structuralTypeName(type);
  const implementedInterface =
    type.kind === "named" && type.declarationKind === "interface"
      ? renderCSharpType(type, context)
      : undefined;
  const implementedInterfaceClause = implementedInterface
    ? ` : ${implementedInterface}`
    : "";
  const typeParameterList = renderTypeParameters(
    structuralTypeParameterNames(type)
  );
  const structuralTypeParameters = structuralTypeParameterNames(type);
  const whereClauses = renderStructuralWhereClauses(
    type.kind === "named" ? type.typeParameterConstraints : undefined,
    structuralTypeParameters,
    context
  );
  return [
    `public sealed class ${name}${typeParameterList}${implementedInterfaceClause}${whereClauses}`,
    "{",
    ...structuralObjectMembers(type, objectTarget).flatMap((member) =>
      renderStructuralObjectMember(member, context)
    ),
    "}",
  ].join("\n");
};
