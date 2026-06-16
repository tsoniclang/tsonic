import type { LoweringTypeRefPlan } from "@tsonic/frontend";
import type { RenderContext } from "../types.js";
import {
  isRecursiveRuntimeArrayArm,
  renderCSharpType,
  renderNullableCSharpType,
  renderStructuralTypeReference,
  renderTypeMember,
  renderTypeParameters,
  runtimeUnionValueMemberName,
  runtimeUnionCarrierArms,
  structuralTypeName,
  structuralTypeParameterNames,
} from "./types.js";

type StructuralDeclarationOptions = {
  readonly declarationName?: string;
  readonly typeReference?: string;
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
    const typeReference =
      options.typeReference ?? renderStructuralTypeReference(type, context);
    return [
      `public sealed class ${name}${typeParameterList}`,
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
  if (type.kind !== "object") return undefined;
  const name = options.declarationName ?? structuralTypeName(type);
  const typeParameterList = renderTypeParameters(
    structuralTypeParameterNames(type)
  );
  const hasMethods = type.members.some((member) => member.kind === "method");
  if (hasMethods) {
    return [
      `public interface ${name}${typeParameterList}`,
      "{",
      ...type.members.map((member) => `    ${renderTypeMember(member, context)}`),
      "}",
    ].join("\n");
  }
  return [
    `public sealed class ${name}${typeParameterList}`,
    "{",
    ...type.members.map(
      (member) => `    public ${renderTypeMember(member, context)}`
    ),
    "}",
  ].join("\n");
};
