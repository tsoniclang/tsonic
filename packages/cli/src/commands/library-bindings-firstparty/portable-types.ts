import { posix } from "node:path";
import type { IrParameter, IrType, IrTypeParameter } from "@tsonic/frontend";
import * as ts from "typescript";
import type {
  AnonymousStructuralAliasInfo,
  SourceTypeImportBinding,
  WrapperImport,
} from "./types.js";
import { moduleNamespacePath } from "./module-paths.js";

export const primitiveImportLine =
  "import type { sbyte, byte, short, ushort, int, uint, long, ulong, int128, uint128, half, float, double, decimal, nint, nuint, char } from '@tsonic/core/types.js';";

const typePrinter = ts.createPrinter({ removeComments: true });

export const printTypeNodeText = (
  node: ts.TypeNode,
  sourceFile: ts.SourceFile
): string => {
  const raw = node.getText(sourceFile).trim();
  if (raw.length > 0) {
    return raw;
  }
  return typePrinter
    .printNode(ts.EmitHint.Unspecified, node, sourceFile)
    .trim();
};

export const ensureUndefinedInType = (typeText: string): string => {
  const trimmed = typeText.trim();
  if (/\bundefined\b/.test(trimmed)) return trimmed;
  return `${trimmed} | undefined`;
};

export const textContainsIdentifier = (
  text: string,
  identifier: string
): boolean => {
  const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^A-Za-z0-9_$])${escaped}([^A-Za-z0-9_$]|$)`).test(
    text
  );
};

export const toRelativeImportSpecifier = (
  fromFile: string,
  targetFile: string
): string => {
  const relative = posix.relative(posix.dirname(fromFile), targetFile);
  if (relative.startsWith(".")) return relative;
  return `./${relative}`;
};

export const namespaceInternalImportSpecifier = (
  fromNamespace: string,
  targetNamespace: string
): string => {
  return toRelativeImportSpecifier(
    posix.join(moduleNamespacePath(fromNamespace), "internal", "index.js"),
    posix.join(moduleNamespacePath(targetNamespace), "internal", "index.js")
  );
};

export const namespaceFacadeImportSpecifier = (
  fromNamespace: string,
  targetNamespace: string
): string => {
  return toRelativeImportSpecifier(
    `${moduleNamespacePath(fromNamespace)}.js`,
    `${moduleNamespacePath(targetNamespace)}.js`
  );
};

export const selectSourceTypeImportsForRenderedText = (
  renderedText: string,
  candidates: readonly SourceTypeImportBinding[]
): readonly SourceTypeImportBinding[] => {
  return candidates
    .filter((candidate) =>
      textContainsIdentifier(renderedText, candidate.localName)
    )
    .sort((left, right) => left.localName.localeCompare(right.localName));
};

export const applyWrappersToBaseType = (
  baseType: string,
  wrappers: readonly WrapperImport[]
): string => {
  let expr = baseType.trim();
  for (const w of wrappers.slice().reverse()) {
    expr = `${w.aliasName}<${expr}>`;
  }
  return expr;
};

export const getPropertyNameText = (
  name: ts.PropertyName
): string | undefined => {
  if (ts.isIdentifier(name)) return name.text;
  if (ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  return undefined;
};

export const sanitizeForBrand = (value: string): string => {
  const normalized = value.replace(/[^A-Za-z0-9_]/g, "_");
  return normalized.length > 0 ? normalized : "_";
};

export const renderBindingAliasMarker = (
  namespace: string,
  bindingAlias: string
): string =>
  `    readonly ${JSON.stringify(`__tsonic_binding_alias_${namespace}.${bindingAlias}`)}?: never;`;

export const isPortableMarkerMemberName = (name: string): boolean =>
  name === "__brand" ||
  name.startsWith("__tsonic_type_") ||
  name.startsWith("__tsonic_iface_") ||
  name.startsWith("__tsonic_binding_alias_");

export const printTypeParameters = (
  typeParameters: readonly IrTypeParameter[] | undefined
): string => {
  if (!typeParameters || typeParameters.length === 0) return "";
  return `<${typeParameters.map((typeParameter) => typeParameter.name).join(", ")}>`;
};

export const normalizeTypeReferenceName = (
  name: string,
  arity?: number
): string => {
  const withoutNamespace = (() => {
    const dotIndex = Math.max(name.lastIndexOf("."), name.lastIndexOf("+"));
    return dotIndex >= 0 ? name.slice(dotIndex + 1) : name;
  })();

  const backtickNormalized = withoutNamespace.replace(/`(\d+)$/, "_$1");
  if (!arity || arity <= 0) return backtickNormalized;
  if (new RegExp(`_${arity}$`).test(backtickNormalized)) {
    return backtickNormalized;
  }
  return `${backtickNormalized}_${arity}`;
};

export const renderReferenceType = (
  referenceName: string,
  typeArguments: readonly IrType[] | undefined,
  typeParametersInScope: readonly string[],
  localTypeNameRemaps: ReadonlyMap<string, string> = new Map()
): string => {
  if (typeParametersInScope.includes(referenceName)) return referenceName;
  if (referenceName === "unknown") return "unknown";
  if (referenceName === "any") return "unknown";
  if (referenceName === "object") return "object";
  if (referenceName === "string") return "string";
  if (referenceName === "boolean") return "boolean";
  if (referenceName === "number") return "number";

  const effectiveReferenceName =
    localTypeNameRemaps.get(referenceName) ?? referenceName;
  let normalizedName = normalizeTypeReferenceName(effectiveReferenceName);
  if (typeArguments && typeArguments.length > 0) {
    const arityMatch = normalizedName.match(/_(\d+)$/);
    if (
      arityMatch &&
      arityMatch[1] &&
      Number(arityMatch[1]) === typeArguments.length &&
      !normalizedName.includes("__Alias_") &&
      !normalizedName.includes("__")
    ) {
      normalizedName = normalizedName.slice(0, -arityMatch[0].length);
    } else if (
      normalizedName.endsWith("_") &&
      !normalizedName.includes("__Alias_")
    ) {
      normalizedName = normalizedName.slice(0, -1);
    }
  }
  if (!typeArguments || typeArguments.length === 0) return normalizedName;
  return `${normalizedName}<${typeArguments
    .map((arg) =>
      renderPortableType(arg, typeParametersInScope, localTypeNameRemaps)
    )
    .join(", ")}>`;
};

export const renderPortableType = (
  type: IrType | undefined,
  typeParametersInScope: readonly string[] = [],
  localTypeNameRemaps: ReadonlyMap<string, string> = new Map(),
  anonymousStructuralAliases: ReadonlyMap<
    string,
    AnonymousStructuralAliasInfo
  > = new Map()
): string => {
  const renderPortableShapeType = (
    shapeType: IrType | undefined,
    shapeTypeParametersInScope: readonly string[] = []
  ): string => {
    if (!shapeType) return "object";

    switch (shapeType.kind) {
      case "primitiveType":
        return shapeType.name;
      case "literalType":
        return typeof shapeType.value === "string"
          ? JSON.stringify(shapeType.value)
          : String(shapeType.value);
      case "voidType":
        return "void";
      case "neverType":
        return "never";
      case "unknownType":
      case "anyType":
        return "unknown";
      case "typeParameterType":
        return shapeType.name;
      case "arrayType":
        return `${renderPortableShapeType(
          shapeType.elementType,
          shapeTypeParametersInScope
        )}[]`;
      case "tupleType":
        return `[${shapeType.elementTypes
          .map((item) =>
            renderPortableShapeType(item, shapeTypeParametersInScope)
          )
          .join(", ")}]`;
      case "unionType":
        return shapeType.types
          .map((item) =>
            renderPortableShapeType(item, shapeTypeParametersInScope)
          )
          .join(" | ");
      case "intersectionType":
        return shapeType.types
          .map((item) =>
            renderPortableShapeType(item, shapeTypeParametersInScope)
          )
          .join(" & ");
      case "dictionaryType":
        return `Record<${renderPortableShapeType(
          shapeType.keyType,
          shapeTypeParametersInScope
        )}, ${renderPortableShapeType(
          shapeType.valueType,
          shapeTypeParametersInScope
        )}>`;
      case "functionType":
        return `(${shapeType.parameters
          .map((parameter, index) => {
            const parameterName =
              parameter.pattern.kind === "identifierPattern"
                ? parameter.pattern.name
                : `p${index + 1}`;
            return `${parameterName}: ${renderPortableShapeType(
              parameter.type,
              shapeTypeParametersInScope
            )}`;
          })
          .join(", ")}) => ${renderPortableShapeType(
          shapeType.returnType,
          shapeTypeParametersInScope
        )}`;
      case "objectType":
        return `{ ${shapeType.members
          .filter((member) => !isPortableMarkerMemberName(member.name))
          .map((member) => {
            if (member.kind === "methodSignature") {
              return `${member.name}${printTypeParameters(
                member.typeParameters
              )}(${member.parameters
                .map((parameter, index) => {
                  const parameterName =
                    parameter.pattern.kind === "identifierPattern"
                      ? parameter.pattern.name
                      : `p${index + 1}`;
                  const optionalMark = parameter.isOptional ? "?" : "";
                  return `${parameterName}${optionalMark}: ${renderPortableShapeType(
                    parameter.type,
                    shapeTypeParametersInScope
                  )}`;
                })
                .join(", ")}): ${renderPortableShapeType(
                member.returnType,
                shapeTypeParametersInScope
              )}`;
            }
            const optionalMark = member.isOptional ? "?" : "";
            const readonlyMark = member.isReadonly ? "readonly " : "";
            return `${readonlyMark}${member.name}${optionalMark}: ${renderPortableShapeType(
              member.type,
              shapeTypeParametersInScope
            )}`;
          })
          .join("; ")} }`;
      case "referenceType":
        return renderReferenceType(
          shapeType.name,
          shapeType.typeArguments,
          shapeTypeParametersInScope,
          localTypeNameRemaps
        );
      default:
        return "object";
    }
  };

  if (!type) return "object";

  switch (type.kind) {
    case "objectType": {
      const shape = renderPortableShapeType(type, typeParametersInScope);
      const alias = anonymousStructuralAliases.get(shape);
      if (alias) {
        const typeArgs =
          alias.typeParameters.length > 0
            ? `<${alias.typeParameters.join(", ")}>`
            : "";
        return `${alias.name}${typeArgs}`;
      }
      return shape;
    }
    case "arrayType":
      return `${renderPortableType(
        type.elementType,
        typeParametersInScope,
        localTypeNameRemaps,
        anonymousStructuralAliases
      )}[]`;
    case "tupleType":
      return `[${type.elementTypes
        .map((item) =>
          renderPortableType(
            item,
            typeParametersInScope,
            localTypeNameRemaps,
            anonymousStructuralAliases
          )
        )
        .join(", ")}]`;
    case "unionType":
      return type.types
        .map((item) =>
          renderPortableType(
            item,
            typeParametersInScope,
            localTypeNameRemaps,
            anonymousStructuralAliases
          )
        )
        .join(" | ");
    case "intersectionType":
      return type.types
        .map((item) =>
          renderPortableType(
            item,
            typeParametersInScope,
            localTypeNameRemaps,
            anonymousStructuralAliases
          )
        )
        .join(" & ");
    case "dictionaryType":
      return `Record<${renderPortableType(
        type.keyType,
        typeParametersInScope,
        localTypeNameRemaps,
        anonymousStructuralAliases
      )}, ${renderPortableType(
        type.valueType,
        typeParametersInScope,
        localTypeNameRemaps,
        anonymousStructuralAliases
      )}>`;
    case "functionType":
      return `(${type.parameters
        .map((parameter, index) => {
          const parameterName =
            parameter.pattern.kind === "identifierPattern"
              ? parameter.pattern.name
              : `p${index + 1}`;
          return `${parameterName}: ${renderPortableType(
            parameter.type,
            typeParametersInScope,
            localTypeNameRemaps,
            anonymousStructuralAliases
          )}`;
        })
        .join(", ")}) => ${renderPortableType(
        type.returnType,
        typeParametersInScope,
        localTypeNameRemaps,
        anonymousStructuralAliases
      )}`;
    default:
      return renderPortableShapeType(type, typeParametersInScope);
  }
};

export const renderUnknownParameters = (
  parameters: readonly IrParameter[],
  typeParametersInScope: readonly string[],
  localTypeNameRemaps: ReadonlyMap<string, string> = new Map(),
  anonymousStructuralAliases: ReadonlyMap<
    string,
    AnonymousStructuralAliasInfo
  > = new Map()
): string => {
  return parameters
    .map((parameter, index) => {
      const baseName =
        parameter.pattern.kind === "identifierPattern"
          ? parameter.pattern.name
          : `p${index + 1}`;
      const restPrefix = parameter.isRest ? "..." : "";
      const optionalMark = parameter.isOptional && !parameter.isRest ? "?" : "";
      const parameterType = renderPortableType(
        parameter.type,
        typeParametersInScope,
        localTypeNameRemaps,
        anonymousStructuralAliases
      );
      const typeSuffix = parameter.isRest
        ? `${parameterType}[]`
        : parameterType;
      return `${restPrefix}${baseName}${optionalMark}: ${typeSuffix}`;
    })
    .join(", ");
};

export const renderMethodSignature = (
  name: string,
  typeParameters: readonly IrTypeParameter[] | undefined,
  parameters: readonly IrParameter[],
  returnType: IrType | undefined,
  localTypeNameRemaps: ReadonlyMap<string, string> = new Map(),
  anonymousStructuralAliases: ReadonlyMap<
    string,
    AnonymousStructuralAliasInfo
  > = new Map()
): string => {
  const typeParametersText = printTypeParameters(typeParameters);
  const typeParameterNames =
    typeParameters?.map((typeParameter) => typeParameter.name) ?? [];
  const parametersText = renderUnknownParameters(
    parameters,
    typeParameterNames,
    localTypeNameRemaps,
    anonymousStructuralAliases
  );
  const returnTypeText = renderPortableType(
    returnType,
    typeParameterNames,
    localTypeNameRemaps,
    anonymousStructuralAliases
  );
  return `${name}${typeParametersText}(${parametersText}): ${returnTypeText};`;
};
