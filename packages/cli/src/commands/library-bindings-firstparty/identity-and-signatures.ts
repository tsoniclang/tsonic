import type {
  IrMethodDeclaration,
  IrParameter,
  IrType,
  IrTypeParameter,
} from "@tsonic/frontend";
import type { FirstPartyBindingsMethod } from "./types.js";
import { normalizeTypeReferenceName } from "./portable-types.js";
import { buildSemanticSignature } from "./semantic-rewrite.js";

export const moduleNamespaceToInternalSpecifier = (namespace: string): string => {
  const nsPath = namespace.length > 0 ? namespace : "index";
  return `./${nsPath}/internal/index.js`;
};

export const toClrTypeName = (
  namespace: string,
  typeName: string,
  arity?: number
): string => {
  const suffix = arity && arity > 0 ? `\`${arity}` : "";
  return `${namespace}.${typeName}${suffix}`;
};

export const toBindingTypeAlias = (
  namespace: string,
  typeName: string,
  arity?: number
): string => {
  const normalizedName = normalizeTypeReferenceName(typeName, arity);
  return namespace.length > 0
    ? `${namespace}.${normalizedName}`
    : normalizedName;
};

export const toStableId = (assemblyName: string, clrName: string): string => {
  return `${assemblyName}:${clrName}`;
};

export const primitiveSignatureType = (name: string): string => {
  const map: Readonly<Record<string, string>> = {
    string: "System.String",
    boolean: "System.Boolean",
    number: "System.Double",
    int: "System.Int32",
    char: "System.Char",
    null: "System.Object",
    undefined: "System.Object",
  };
  return map[name] ?? name;
};

export const isNumericValueType = (name: string): boolean => {
  return (
    name === "System.Int32" ||
    name === "System.Double" ||
    name === "System.Single" ||
    name === "System.Decimal" ||
    name === "System.Int64" ||
    name === "System.Int16" ||
    name === "System.UInt16" ||
    name === "System.UInt32" ||
    name === "System.UInt64" ||
    name === "System.Byte" ||
    name === "System.SByte"
  );
};

export const toSignatureType = (
  type: IrType | undefined,
  typeParametersInScope: readonly string[],
  localTypeNameRemaps: ReadonlyMap<string, string> = new Map()
): string => {
  if (!type) return "System.Object";

  switch (type.kind) {
    case "primitiveType":
      return primitiveSignatureType(type.name);
    case "literalType":
      if (typeof type.value === "string") return "System.String";
      if (typeof type.value === "boolean") return "System.Boolean";
      if (typeof type.value === "number") return "System.Double";
      return "System.Object";
    case "voidType":
      return "System.Void";
    case "neverType":
    case "unknownType":
    case "anyType":
      return "System.Object";
    case "typeParameterType":
      return type.name;
    case "arrayType":
      return `${toSignatureType(type.elementType, typeParametersInScope, localTypeNameRemaps)}[]`;
    case "tupleType":
    case "objectType":
    case "functionType":
    case "dictionaryType":
      return "System.Object";
    case "intersectionType":
      return toSignatureType(
        type.types[0],
        typeParametersInScope,
        localTypeNameRemaps
      );
    case "unionType": {
      const nonUndefined = type.types.filter((candidate) => {
        return !(
          candidate.kind === "primitiveType" && candidate.name === "undefined"
        );
      });
      if (nonUndefined.length === 1 && nonUndefined[0]) {
        const single = toSignatureType(
          nonUndefined[0],
          typeParametersInScope,
          localTypeNameRemaps
        );
        if (isNumericValueType(single)) {
          return `System.Nullable\`1[[${single}]]`;
        }
        return single;
      }
      return "System.Object";
    }
    case "referenceType": {
      if (typeParametersInScope.includes(type.name)) return type.name;
      const normalizedName = normalizeTypeReferenceName(
        localTypeNameRemaps.get(type.name) ?? type.name,
        type.typeArguments?.length
      );
      if (!type.typeArguments || type.typeArguments.length === 0) {
        return normalizedName;
      }
      const args = type.typeArguments
        .map((arg) =>
          toSignatureType(arg, typeParametersInScope, localTypeNameRemaps)
        )
        .join(",");
      return `${normalizedName}[[${args}]]`;
    }
    default:
      return "System.Object";
  }
};

export const buildParameterModifiers = (
  parameters: readonly IrParameter[]
): readonly {
  readonly index: number;
  readonly modifier: "ref" | "out" | "in";
}[] => {
  const modifiers = parameters
    .map((parameter, index) => {
      if (parameter.passing === "value") return undefined;
      return { index, modifier: parameter.passing };
    })
    .filter((modifier) => modifier !== undefined);

  return modifiers;
};

export const makeMethodBinding = (opts: {
  readonly declaringClrType: string;
  readonly declaringAssemblyName: string;
  readonly methodName: string;
  readonly parameters: readonly IrParameter[];
  readonly returnType: IrType | undefined;
  readonly typeParameters?: readonly IrTypeParameter[];
  readonly overloadFamily?: import("@tsonic/frontend").IrOverloadFamilyMember;
  readonly arity: number;
  readonly parameterModifiers: readonly {
    readonly index: number;
    readonly modifier: "ref" | "out" | "in";
  }[];
  readonly isStatic: boolean;
  readonly isAbstract?: boolean;
  readonly isVirtual?: boolean;
  readonly isOverride?: boolean;
  readonly isSealed?: boolean;
  readonly localTypeNameRemaps?: ReadonlyMap<string, string>;
}): FirstPartyBindingsMethod => {
  const typeParameterScope = Array.from(
    new Set(
      opts.parameters
        .map((parameter) =>
          parameter.type?.kind === "typeParameterType"
            ? parameter.type.name
            : undefined
        )
        .filter((name): name is string => name !== undefined)
    )
  );

  const normalizedSignature = `${opts.methodName}|(${opts.parameters
    .map((parameter) =>
      toSignatureType(
        parameter.type,
        typeParameterScope,
        opts.localTypeNameRemaps
      )
    )
    .join(",")}):${toSignatureType(
    opts.returnType,
    typeParameterScope,
    opts.localTypeNameRemaps
  )}|static=${opts.isStatic ? "true" : "false"}`;
  const stableId = `${toStableId(
    opts.declaringAssemblyName,
    opts.declaringClrType
  )}::method:${opts.methodName}|${normalizedSignature}`;

  return {
    stableId,
    clrName: opts.methodName,
    normalizedSignature,
    semanticSignature: buildSemanticSignature({
      typeParameters: opts.typeParameters,
      parameters: opts.parameters,
      returnType: opts.returnType,
      localTypeNameRemaps: opts.localTypeNameRemaps ?? new Map(),
    }),
    overloadFamily: opts.overloadFamily,
    arity: opts.arity,
    parameterCount: opts.parameters.length,
    isStatic: opts.isStatic,
    isAbstract: opts.isAbstract ?? false,
    isVirtual: opts.isVirtual ?? false,
    isOverride: opts.isOverride ?? false,
    isSealed: opts.isSealed ?? false,
    declaringClrType: opts.declaringClrType,
    declaringAssemblyName: opts.declaringAssemblyName,
    parameterModifiers:
      opts.parameterModifiers.length > 0 ? opts.parameterModifiers : undefined,
    isExtensionMethod: false,
  };
};

export const isPublicOverloadSurfaceMethod = (
  member: IrMethodDeclaration
): boolean => member.overloadFamily?.role !== "implementation";
