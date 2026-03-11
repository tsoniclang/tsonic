import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, posix, resolve } from "node:path";
import type {
  CompilerOptions,
  IrClassDeclaration,
  IrEnumDeclaration,
  IrInterfaceMember,
  IrInterfaceDeclaration,
  IrModule,
  IrParameter,
  IrStatement,
  IrType,
  IrTypeAliasDeclaration,
  IrTypeParameter,
} from "@tsonic/frontend";
import { buildModuleDependencyGraph } from "@tsonic/frontend";
import * as ts from "typescript";
import { resolveSurfaceCapabilities } from "../surface/profiles.js";
import type { ResolvedConfig, Result } from "../types.js";
import { overlayDependencyBindings } from "./library-bindings-augment.js";

type FirstPartyBindingsMethod = {
  readonly stableId: string;
  readonly clrName: string;
  readonly normalizedSignature: string;
  readonly emitScope?: string;
  readonly provenance?: string;
  readonly arity: number;
  readonly parameterCount: number;
  readonly isStatic: boolean;
  readonly isAbstract: boolean;
  readonly isVirtual: boolean;
  readonly isOverride: boolean;
  readonly isSealed: boolean;
  readonly declaringClrType: string;
  readonly declaringAssemblyName: string;
  readonly parameterModifiers?: ReadonlyArray<{
    readonly index: number;
    readonly modifier: "ref" | "out" | "in";
  }>;
  readonly isExtensionMethod: boolean;
  readonly metadataToken?: number;
};

type FirstPartyBindingsProperty = {
  readonly stableId: string;
  readonly clrName: string;
  readonly normalizedSignature: string;
  readonly isStatic: boolean;
  readonly isAbstract: boolean;
  readonly isVirtual: boolean;
  readonly isOverride: boolean;
  readonly isIndexer: boolean;
  readonly hasGetter: boolean;
  readonly hasSetter: boolean;
  readonly declaringClrType: string;
  readonly declaringAssemblyName: string;
  readonly metadataToken?: number;
};

type FirstPartyBindingsField = {
  readonly stableId: string;
  readonly clrName: string;
  readonly normalizedSignature: string;
  readonly isStatic: boolean;
  readonly isReadOnly: boolean;
  readonly isLiteral: boolean;
  readonly declaringClrType: string;
  readonly declaringAssemblyName: string;
  readonly metadataToken?: number;
};

type FirstPartyBindingsConstructor = {
  readonly normalizedSignature: string;
  readonly isStatic: boolean;
  readonly parameterCount: number;
};

type FirstPartyBindingsType = {
  readonly stableId: string;
  readonly clrName: string;
  readonly alias: string;
  readonly assemblyName: string;
  readonly kind: "Class" | "Interface" | "Struct" | "Enum";
  readonly accessibility: "Public" | "Internal" | "Private" | "Protected";
  readonly isAbstract: boolean;
  readonly isSealed: boolean;
  readonly isStatic: boolean;
  readonly arity: number;
  readonly typeParameters?: readonly string[];
  readonly methods: readonly FirstPartyBindingsMethod[];
  readonly properties: readonly FirstPartyBindingsProperty[];
  readonly fields: readonly FirstPartyBindingsField[];
  readonly events: readonly unknown[];
  readonly constructors: readonly FirstPartyBindingsConstructor[];
  readonly metadataToken?: number;
};

type FirstPartyBindingsExport = {
  readonly kind: "method" | "property" | "field";
  readonly clrName: string;
  readonly declaringClrType: string;
  readonly declaringAssemblyName: string;
};

type FirstPartyBindingsFile = {
  readonly namespace: string;
  readonly contributingAssemblies: readonly string[];
  readonly types: readonly FirstPartyBindingsType[];
  readonly exports?: Readonly<Record<string, FirstPartyBindingsExport>>;
  readonly producer: {
    readonly tool: "tsonic";
    readonly mode: "aikya-firstparty";
  };
};

type ExportedSymbolKind =
  | "function"
  | "variable"
  | "class"
  | "interface"
  | "enum"
  | "typeAlias";

type ExportedSymbol = {
  readonly exportName: string;
  readonly localName: string;
  readonly kind: ExportedSymbolKind;
  readonly declaration: IrStatement;
  readonly declaringNamespace: string;
  readonly declaringClassName: string;
  readonly declaringFilePath: string;
};

type ResolvedExportDeclaration = {
  readonly declaration: IrStatement;
  readonly module: IrModule;
  readonly clrName: string;
};

type ModuleContainerEntry = {
  readonly module: IrModule;
  readonly methods: {
    readonly exportName: string;
    readonly localName: string;
    readonly declaration: Extract<IrStatement, { kind: "functionDeclaration" }>;
    readonly localTypeNameRemaps: ReadonlyMap<string, string>;
    readonly sourceSignatures: readonly SourceFunctionSignatureDef[];
  }[];
  readonly variables: {
    readonly exportName: string;
    readonly localName: string;
    readonly declaration: Extract<IrStatement, { kind: "variableDeclaration" }>;
    readonly declarator:
      | {
          readonly kind: "variableDeclarator";
          readonly name: {
            readonly kind: "identifierPattern";
          readonly name: string;
        };
        readonly type?: IrType;
      }
      | undefined;
    readonly localTypeNameRemaps: ReadonlyMap<string, string>;
    readonly sourceType: SourceValueTypeDef | undefined;
    readonly sourceSignatures: readonly SourceFunctionSignatureDef[];
  }[];
};

type SourceTypeImport = {
  readonly source: string;
  readonly importedName: string;
};

type SourceTypeImportBinding = {
  readonly source: string;
  readonly importedName: string;
  readonly localName: string;
};

type SourceTypeAliasDef = {
  readonly typeParametersText: string;
  readonly typeParameterNames: readonly string[];
  readonly type: ts.TypeNode;
  readonly typeText: string;
};

type SourceMemberTypeDef = {
  readonly typeNode: ts.TypeNode;
  readonly typeText: string;
  readonly isOptional: boolean;
};

type SourceFunctionSignatureDef = {
  readonly typeParametersText: string;
  readonly typeParameterCount: number;
  readonly parameters: readonly {
    readonly prefixText: string;
    readonly typeText: string;
  }[];
  readonly returnTypeText: string;
};

type SourceValueTypeDef = {
  readonly typeText: string;
};

type AnonymousStructuralAliasInfo = {
  readonly name: string;
  readonly typeParameters: readonly string[];
};

type ModuleSourceIndex = {
  readonly fileKey: string;
  readonly wrapperImportsByLocalName: ReadonlyMap<string, SourceTypeImport>;
  readonly typeImportsByLocalName: ReadonlyMap<string, SourceTypeImport>;
  readonly typeAliasesByName: ReadonlyMap<string, SourceTypeAliasDef>;
  readonly exportedTypeDeclarationNames: ReadonlySet<string>;
  readonly exportedFunctionSignaturesByName: ReadonlyMap<
    string,
    readonly SourceFunctionSignatureDef[]
  >;
  readonly exportedValueTypesByName: ReadonlyMap<string, SourceValueTypeDef>;
  readonly memberTypesByClassAndMember: ReadonlyMap<
    string,
    ReadonlyMap<string, SourceMemberTypeDef>
  >;
};

type InternalHelperTypeKind = "class" | "interface" | "enum" | "typeAlias";

type InternalHelperTypeDeclaration = {
  readonly key: string;
  readonly moduleFileKey: string;
  readonly declaringNamespace: string;
  readonly emittedName: string;
  readonly originalName: string;
  readonly kind: InternalHelperTypeKind;
  readonly declaration:
    | IrClassDeclaration
    | IrInterfaceDeclaration
    | IrEnumDeclaration
    | IrTypeAliasDeclaration;
};

type WrapperImport = {
  readonly source: string;
  readonly importedName: string;
  readonly localName: string;
  readonly aliasName: string;
};

type MemberOverride = {
  readonly className: string;
  readonly memberName: string;
  readonly sourceTypeText?: string;
  readonly replaceWithSourceType?: boolean;
  readonly isOptional?: boolean;
  readonly emitOptionalPropertySyntax?: boolean;
  readonly wrappers: readonly WrapperImport[];
};

type NamespacePlan = {
  readonly namespace: string;
  readonly typeDeclarations: readonly ExportedSymbol[];
  readonly internalHelperTypeDeclarations: readonly InternalHelperTypeDeclaration[];
  readonly moduleContainers: readonly ModuleContainerEntry[];
  readonly crossNamespaceReexports: {
    readonly dtsStatements: readonly string[];
    readonly jsValueStatements: readonly string[];
  };
  readonly crossNamespaceTypeDeclarations: readonly ExportedSymbol[];
  readonly sourceAliasLines: readonly string[];
  readonly sourceAliasInternalImports: readonly string[];
  readonly memberOverrides: readonly MemberOverride[];
  readonly internalTypeImports: readonly SourceTypeImportBinding[];
  readonly facadeTypeImports: readonly SourceTypeImportBinding[];
  readonly wrapperImports: readonly WrapperImport[];
  readonly valueExports: readonly {
    readonly exportName: string;
    readonly binding: FirstPartyBindingsExport;
    readonly facade:
        | {
          readonly kind: "function";
          readonly declaration: Extract<
            IrStatement,
            { kind: "functionDeclaration" }
          >;
          readonly sourceSignatures?: readonly SourceFunctionSignatureDef[];
          readonly localTypeNameRemaps: ReadonlyMap<string, string>;
        }
      | {
          readonly kind: "variable";
          readonly declarator:
            | {
                readonly kind: "variableDeclarator";
                readonly name: {
                  readonly kind: "identifierPattern";
                  readonly name: string;
                };
                readonly type?: IrType;
              }
            | undefined;
          readonly localTypeNameRemaps: ReadonlyMap<string, string>;
          readonly sourceType?: SourceValueTypeDef;
          readonly sourceSignatures?: readonly SourceFunctionSignatureDef[];
        };
  }[];
};

const primitiveImportLine =
  "import type { sbyte, byte, short, ushort, int, uint, long, ulong, int128, uint128, half, float, double, decimal, nint, nuint, char } from '@tsonic/core/types.js';";

const typePrinter = ts.createPrinter({ removeComments: true });

const printTypeNodeText = (
  node: ts.TypeNode,
  sourceFile: ts.SourceFile
): string => {
  return typePrinter
    .printNode(ts.EmitHint.Unspecified, node, sourceFile)
    .trim();
};

const ensureUndefinedInType = (typeText: string): string => {
  const trimmed = typeText.trim();
  if (/\bundefined\b/.test(trimmed)) return trimmed;
  return `${trimmed} | undefined`;
};

const textContainsIdentifier = (text: string, identifier: string): boolean => {
  const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^A-Za-z0-9_$])${escaped}([^A-Za-z0-9_$]|$)`).test(
    text
  );
};

const toRelativeImportSpecifier = (
  fromFile: string,
  targetFile: string
): string => {
  const relative = posix.relative(posix.dirname(fromFile), targetFile);
  if (relative.startsWith(".")) return relative;
  return `./${relative}`;
};

const namespaceInternalImportSpecifier = (
  fromNamespace: string,
  targetNamespace: string
): string => {
  return toRelativeImportSpecifier(
    posix.join(moduleNamespacePath(fromNamespace), "internal", "index.js"),
    posix.join(moduleNamespacePath(targetNamespace), "internal", "index.js")
  );
};

const namespaceFacadeImportSpecifier = (
  fromNamespace: string,
  targetNamespace: string
): string => {
  return toRelativeImportSpecifier(
    `${moduleNamespacePath(fromNamespace)}.js`,
    `${moduleNamespacePath(targetNamespace)}.js`
  );
};

const resolveSourceTypeImportBinding = (opts: {
  readonly context: "internal" | "facade";
  readonly currentNamespace: string;
  readonly currentModuleKey: string;
  readonly localName: string;
  readonly imported: SourceTypeImport;
  readonly modulesByFileKey: ReadonlyMap<string, IrModule>;
}): Result<SourceTypeImportBinding | undefined, string> => {
  const source = opts.imported.source.trim();
  if (source === "@tsonic/core/types.js") {
    return { ok: true, value: undefined };
  }

  if (!isRelativeModuleSpecifier(source)) {
    return {
      ok: true,
      value: {
        source,
        importedName: opts.imported.importedName,
        localName: opts.localName,
      },
    };
  }

  const targetModule = resolveLocalModuleFile(
    source,
    opts.currentModuleKey,
    opts.modulesByFileKey
  );
  if (!targetModule) {
    return {
      ok: false,
      error:
        `Unable to resolve source type import '${opts.localName}' from '${source}' in ${opts.currentModuleKey}.\n` +
        "First-party bindings generation requires public type dependencies to resolve deterministically.",
    };
  }

  if (targetModule.namespace === opts.currentNamespace) {
    return { ok: true, value: undefined };
  }

  return {
    ok: true,
    value: {
      source:
        opts.context === "internal"
          ? namespaceInternalImportSpecifier(
              opts.currentNamespace,
              targetModule.namespace
            )
          : namespaceFacadeImportSpecifier(
              opts.currentNamespace,
              targetModule.namespace
            ),
      importedName: opts.imported.importedName,
      localName: opts.localName,
    },
  };
};

const registerSourceTypeImportBinding = (
  registry: Map<string, SourceTypeImportBinding>,
  binding: SourceTypeImportBinding,
  namespace: string,
  moduleFilePath: string
): Result<void, string> => {
  const existing = registry.get(binding.localName);
  if (existing) {
    if (
      existing.source !== binding.source ||
      existing.importedName !== binding.importedName
    ) {
      return {
        ok: false,
        error:
          `Conflicting source type import alias '${binding.localName}' while generating namespace ${namespace} from ${moduleFilePath}.\n` +
          `- ${existing.importedName} from '${existing.source}'\n` +
          `- ${binding.importedName} from '${binding.source}'\n` +
          "Disambiguate source type imports so generated bindings remain deterministic.",
      };
    }
    return { ok: true, value: undefined };
  }
  registry.set(binding.localName, binding);
  return { ok: true, value: undefined };
};

const selectSourceTypeImportsForRenderedText = (
  renderedText: string,
  candidates: readonly SourceTypeImportBinding[]
): readonly SourceTypeImportBinding[] => {
  return candidates
    .filter((candidate) => textContainsIdentifier(renderedText, candidate.localName))
    .sort((left, right) => left.localName.localeCompare(right.localName));
};

const applyWrappersToBaseType = (
  baseType: string,
  wrappers: readonly WrapperImport[]
): string => {
  let expr = baseType.trim();
  for (const w of wrappers.slice().reverse()) {
    expr = `${w.aliasName}<${expr}>`;
  }
  return expr;
};

const getPropertyNameText = (name: ts.PropertyName): string | undefined => {
  if (ts.isIdentifier(name)) return name.text;
  if (ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  return undefined;
};

const sanitizeForBrand = (value: string): string => {
  const normalized = value.replace(/[^A-Za-z0-9_]/g, "_");
  return normalized.length > 0 ? normalized : "_";
};

const renderBindingAliasMarker = (
  namespace: string,
  bindingAlias: string
): string =>
  `    readonly ${JSON.stringify(`__tsonic_binding_alias_${namespace}.${bindingAlias}`)}?: never;`;

const isPortableMarkerMemberName = (name: string): boolean =>
  name === "__brand" ||
  name.startsWith("__tsonic_type_") ||
  name.startsWith("__tsonic_iface_") ||
  name.startsWith("__tsonic_binding_alias_");

const printTypeParameters = (
  typeParameters: readonly IrTypeParameter[] | undefined
): string => {
  if (!typeParameters || typeParameters.length === 0) return "";
  return `<${typeParameters.map((typeParameter) => typeParameter.name).join(", ")}>`;
};

const normalizeTypeReferenceName = (name: string, arity?: number): string => {
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

const renderReferenceType = (
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

const renderPortableType = (
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
          .map((item) => renderPortableShapeType(item, shapeTypeParametersInScope))
          .join(", ")}]`;
      case "unionType":
        return shapeType.types
          .map((item) => renderPortableShapeType(item, shapeTypeParametersInScope))
          .join(" | ");
      case "intersectionType":
        return shapeType.types
          .map((item) => renderPortableShapeType(item, shapeTypeParametersInScope))
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
          .join(
            ", "
          )}) => ${renderPortableShapeType(
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

  const typeNeedsAnonymousCanonicalization = (
    candidate: IrType | undefined
  ): boolean => {
    if (!candidate) return false;
    switch (candidate.kind) {
      case "objectType":
        return anonymousStructuralAliases.has(
          renderPortableShapeType(candidate, typeParametersInScope)
        );
      case "arrayType":
        return typeNeedsAnonymousCanonicalization(candidate.elementType);
      case "tupleType":
        return candidate.elementTypes.some(typeNeedsAnonymousCanonicalization);
      case "unionType":
      case "intersectionType":
        return candidate.types.some(typeNeedsAnonymousCanonicalization);
      case "dictionaryType":
        return (
          typeNeedsAnonymousCanonicalization(candidate.keyType) ||
          typeNeedsAnonymousCanonicalization(candidate.valueType)
        );
      case "functionType":
        return (
          candidate.parameters.some((parameter) =>
            typeNeedsAnonymousCanonicalization(parameter.type)
          ) || typeNeedsAnonymousCanonicalization(candidate.returnType)
        );
      case "referenceType":
        return (
          candidate.typeArguments?.some(typeNeedsAnonymousCanonicalization) ??
          false
        );
      default:
        return false;
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
        .join(
          ", "
        )}) => ${renderPortableType(
        type.returnType,
        typeParametersInScope,
        localTypeNameRemaps,
        anonymousStructuralAliases
      )}`;
    default:
      return renderPortableShapeType(type, typeParametersInScope);
  }
};

const renderUnknownParameters = (
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

const renderMethodSignature = (
  name: string,
  typeParameters: readonly IrTypeParameter[] | undefined,
  parameters: readonly IrParameter[],
  returnType: IrType | undefined,
  localTypeNameRemaps: ReadonlyMap<string, string> = new Map()
): string => {
  const typeParametersText = printTypeParameters(typeParameters);
  const typeParameterNames =
    typeParameters?.map((typeParameter) => typeParameter.name) ?? [];
  const parametersText = renderUnknownParameters(
    parameters,
    typeParameterNames,
    localTypeNameRemaps
  );
  const returnTypeText = renderPortableType(
    returnType,
    typeParameterNames,
    localTypeNameRemaps
  );
  return `${name}${typeParametersText}(${parametersText}): ${returnTypeText};`;
};

const renderSourceTypeNodeForAliasLookup = (
  node: ts.TypeNode,
  localTypeNameRemaps: ReadonlyMap<string, string>
): string => {
  switch (node.kind) {
    case ts.SyntaxKind.StringKeyword:
      return "string";
    case ts.SyntaxKind.NumberKeyword:
      return "number";
    case ts.SyntaxKind.BooleanKeyword:
      return "boolean";
    case ts.SyntaxKind.VoidKeyword:
      return "void";
    case ts.SyntaxKind.NeverKeyword:
      return "never";
    case ts.SyntaxKind.UnknownKeyword:
      return "unknown";
    case ts.SyntaxKind.AnyKeyword:
      return "unknown";
    case ts.SyntaxKind.NullKeyword:
      return "null";
    case ts.SyntaxKind.UndefinedKeyword:
      return "undefined";
  }

  if (ts.isParenthesizedTypeNode(node)) {
    return `(${renderSourceTypeNodeForAliasLookup(
      node.type,
      localTypeNameRemaps
    )})`;
  }
  if (ts.isArrayTypeNode(node)) {
    return `${renderSourceTypeNodeForAliasLookup(
      node.elementType,
      localTypeNameRemaps
    )}[]`;
  }
  if (ts.isTupleTypeNode(node)) {
    return `[${node.elements
      .map((element) =>
        renderSourceTypeNodeForAliasLookup(element, localTypeNameRemaps)
      )
      .join(", ")}]`;
  }
  if (ts.isUnionTypeNode(node)) {
    return node.types
      .map((part) => renderSourceTypeNodeForAliasLookup(part, localTypeNameRemaps))
      .join(" | ");
  }
  if (ts.isIntersectionTypeNode(node)) {
    return node.types
      .map((part) => renderSourceTypeNodeForAliasLookup(part, localTypeNameRemaps))
      .join(" & ");
  }
  if (ts.isLiteralTypeNode(node)) {
    return node.getText();
  }
  if (ts.isTypeReferenceNode(node)) {
    const typeNameText = node.typeName.getText();
    const rewrittenTypeName = rewriteSourceTypeText(
      typeNameText,
      localTypeNameRemaps
    );
    if (!node.typeArguments || node.typeArguments.length === 0) {
      return rewrittenTypeName;
    }
    return `${rewrittenTypeName}<${node.typeArguments
      .map((argument) =>
        renderSourceTypeNodeForAliasLookup(argument, localTypeNameRemaps)
      )
      .join(", ")}>`;
  }
  if (ts.isTypeLiteralNode(node)) {
    return `{ ${node.members
      .flatMap((member) => {
        if (ts.isPropertySignature(member)) {
          const propertyName = ts.isIdentifier(member.name)
            ? member.name.text
            : ts.isStringLiteral(member.name)
              ? member.name.text
              : undefined;
          if (!propertyName || !member.type) return [];
          const optionalMark = member.questionToken ? "?" : "";
          const readonlyMark =
            member.modifiers?.some(
              (modifier) => modifier.kind === ts.SyntaxKind.ReadonlyKeyword
            ) ?? false
              ? "readonly "
              : "";
          return [
            `${readonlyMark}${propertyName}${optionalMark}: ${renderSourceTypeNodeForAliasLookup(
              member.type,
              localTypeNameRemaps
            )}`,
          ];
        }
        if (ts.isMethodSignature(member)) {
          const methodName = ts.isIdentifier(member.name)
            ? member.name.text
            : ts.isStringLiteral(member.name)
              ? member.name.text
              : undefined;
          if (!methodName) return [];
          const typeParametersText = member.typeParameters
            ? `<${member.typeParameters
                .map((typeParameter) => typeParameter.name.text)
                .join(", ")}>`
            : "";
          const parametersText = member.parameters
            .map((parameter, index) => {
              const parameterName = ts.isIdentifier(parameter.name)
                ? parameter.name.text
                : `p${index + 1}`;
              const optionalMark = parameter.questionToken ? "?" : "";
              const restPrefix = parameter.dotDotDotToken ? "..." : "";
              const parameterType = parameter.type
                ? renderSourceTypeNodeForAliasLookup(
                    parameter.type,
                    localTypeNameRemaps
                  )
                : "unknown";
              return `${restPrefix}${parameterName}${optionalMark}: ${parameterType}`;
            })
            .join(", ");
          const returnType = member.type
            ? renderSourceTypeNodeForAliasLookup(member.type, localTypeNameRemaps)
            : "void";
          return [`${methodName}${typeParametersText}(${parametersText}): ${returnType}`];
        }
        return [];
      })
      .join("; ")} }`;
  }

  return node.getText();
};

const rewriteSourceTypeText = (
  typeText: string,
  localTypeNameRemaps: ReadonlyMap<string, string>,
  anonymousStructuralAliases: ReadonlyMap<
    string,
    AnonymousStructuralAliasInfo
  > = new Map()
): string => {
  
  const sourceFile = ts.createSourceFile(
    "__tsonic_source_type__.ts",
    `type __T = ${typeText};`,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const statement = sourceFile.statements[0];
  if (!statement || !ts.isTypeAliasDeclaration(statement)) return typeText;

  const transformer = <T extends ts.Node>(
    context: ts.TransformationContext
  ) => {
    const visit = (node: ts.Node): ts.Node => {
      if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName)) {
        const remappedName = localTypeNameRemaps.get(node.typeName.text);
        if (remappedName) {
          return ts.factory.updateTypeReferenceNode(
            node,
            ts.factory.createIdentifier(remappedName),
            node.typeArguments
          );
        }
      }
      if (anonymousStructuralAliases.size > 0 && ts.isTypeLiteralNode(node)) {
        const alias = anonymousStructuralAliases.get(
          renderSourceTypeNodeForAliasLookup(node, localTypeNameRemaps)
        );
        if (alias) {
          return ts.factory.createTypeReferenceNode(
            ts.factory.createIdentifier(alias.name),
            alias.typeParameters.map((typeParameter) =>
              ts.factory.createTypeReferenceNode(typeParameter)
            )
          );
        }
      }
      return ts.visitEachChild(node, visit, context);
    };
    return (node: T): T => ts.visitNode(node, visit) as T;
  };

  const transformed = ts.transform(statement.type, [transformer]).transformed[0];
  if (!transformed) return typeText;
  const printer = ts.createPrinter({ removeComments: true });
  return printer.printNode(ts.EmitHint.Unspecified, transformed, sourceFile);
};

const selectPreferredSourceFunctionSignature = (opts: {
  readonly declaration: Extract<IrStatement, { kind: "functionDeclaration" }>;
  readonly sourceSignatures: readonly SourceFunctionSignatureDef[];
}): SourceFunctionSignatureDef | undefined => {
  const targetTypeParameterCount = opts.declaration.typeParameters?.length ?? 0;
  const targetParameterCount = opts.declaration.parameters.length;

  const exact = opts.sourceSignatures.find((signature) => {
    return (
      signature.parameters.length === targetParameterCount &&
      signature.typeParameterCount === targetTypeParameterCount
    );
  });
  return exact ?? opts.sourceSignatures[0];
};

const renderSourceFunctionSignature = (opts: {
  readonly declaration: Extract<IrStatement, { kind: "functionDeclaration" }>;
  readonly sourceSignatures: readonly SourceFunctionSignatureDef[];
  readonly localTypeNameRemaps: ReadonlyMap<string, string>;
  readonly anonymousStructuralAliases?: ReadonlyMap<
    string,
    AnonymousStructuralAliasInfo
  >;
}):
  | {
      readonly typeParametersText: string;
      readonly parametersText: string;
      readonly returnTypeText: string;
    }
  | undefined => {
  const sourceSignature = selectPreferredSourceFunctionSignature({
    declaration: opts.declaration,
    sourceSignatures: opts.sourceSignatures,
  });
  if (!sourceSignature) return undefined;

  const parametersText = sourceSignature.parameters
    .map(
      (parameter) =>
        `${parameter.prefixText}${rewriteSourceTypeText(
          parameter.typeText,
          opts.localTypeNameRemaps,
          opts.anonymousStructuralAliases
        )}`
    )
    .join(", ");

  return {
    typeParametersText: sourceSignature.typeParametersText,
    parametersText,
    returnTypeText: rewriteSourceTypeText(
      sourceSignature.returnTypeText,
      opts.localTypeNameRemaps,
      opts.anonymousStructuralAliases
    ),
  };
};

const renderSourceValueType = (
  sourceType: SourceValueTypeDef | undefined,
  localTypeNameRemaps: ReadonlyMap<string, string>,
  anonymousStructuralAliases: ReadonlyMap<
    string,
    AnonymousStructuralAliasInfo
  > = new Map()
): string | undefined =>
  !sourceType
    ? undefined
    : rewriteSourceTypeText(
        sourceType.typeText,
        localTypeNameRemaps,
        anonymousStructuralAliases
      );

const renderSourceFunctionType = (opts: {
  readonly sourceSignatures: readonly SourceFunctionSignatureDef[];
  readonly localTypeNameRemaps: ReadonlyMap<string, string>;
  readonly anonymousStructuralAliases?: ReadonlyMap<
    string,
    AnonymousStructuralAliasInfo
  >;
}): string | undefined => {
  const sourceSignature = opts.sourceSignatures[0];
  if (!sourceSignature) return undefined;
  const parametersText = sourceSignature.parameters
    .map(
      (parameter) =>
        `${parameter.prefixText}${rewriteSourceTypeText(
          parameter.typeText,
          opts.localTypeNameRemaps,
          opts.anonymousStructuralAliases
        )}`
    )
    .join(", ");
  return `${sourceSignature.typeParametersText}(${parametersText}) => ${rewriteSourceTypeText(
    sourceSignature.returnTypeText,
    opts.localTypeNameRemaps,
    opts.anonymousStructuralAliases
  )}`;
};

const buildAnonymousStructuralAliasMap = (
  plan: NamespacePlan
): ReadonlyMap<string, AnonymousStructuralAliasInfo> => {
  const aliases = new Map<string, AnonymousStructuralAliasInfo>();

  const registerAnonymousClass = (
    localName: string,
    declaration: IrClassDeclaration
  ): void => {
    if (!localName.startsWith("__Anon_")) return;

    const members: IrInterfaceMember[] = [];
    for (const member of declaration.members) {
      if (member.kind === "propertyDeclaration") {
        if (isPortableMarkerMemberName(member.name)) continue;
        members.push({
          kind: "propertySignature",
          name: member.name,
          type: member.type ?? { kind: "unknownType" },
          isOptional: false,
          isReadonly: member.isReadonly,
        });
        continue;
      }
      if (member.kind === "methodDeclaration") {
        if (isPortableMarkerMemberName(member.name)) continue;
        members.push({
          kind: "methodSignature",
          name: member.name,
          parameters: member.parameters,
          returnType: member.returnType,
          typeParameters: member.typeParameters,
        });
      }
    }

    const shape = renderPortableType(
      { kind: "objectType", members },
      declaration.typeParameters?.map((typeParameter) => typeParameter.name) ?? [],
      new Map(),
      new Map()
    );
    aliases.set(shape, {
      name: localName,
      typeParameters:
        declaration.typeParameters?.map((typeParameter) => typeParameter.name) ??
        [],
    });
  };

  for (const symbol of plan.typeDeclarations) {
    if (symbol.kind !== "class" || symbol.declaration.kind !== "classDeclaration") {
      continue;
    }
    registerAnonymousClass(symbol.localName, symbol.declaration);
  }

  for (const helper of plan.internalHelperTypeDeclarations) {
    if (helper.kind !== "class") continue;
    registerAnonymousClass(
      helper.emittedName,
      helper.declaration as IrClassDeclaration
    );
  }

  return aliases;
};

const collectReferencedPortableTypeNames = (
  type: IrType | undefined,
  typeParametersInScope: ReadonlySet<string>,
  out: Set<string>
): void => {
  if (!type) return;

  switch (type.kind) {
    case "primitiveType":
    case "literalType":
    case "voidType":
    case "neverType":
    case "unknownType":
    case "anyType":
      return;
    case "typeParameterType":
      if (!typeParametersInScope.has(type.name)) {
        out.add(type.name);
      }
      return;
    case "arrayType":
      collectReferencedPortableTypeNames(type.elementType, typeParametersInScope, out);
      return;
    case "tupleType":
      for (const element of type.elementTypes) {
        collectReferencedPortableTypeNames(element, typeParametersInScope, out);
      }
      return;
    case "unionType":
    case "intersectionType":
      for (const member of type.types) {
        collectReferencedPortableTypeNames(member, typeParametersInScope, out);
      }
      return;
    case "dictionaryType":
      collectReferencedPortableTypeNames(type.keyType, typeParametersInScope, out);
      collectReferencedPortableTypeNames(type.valueType, typeParametersInScope, out);
      return;
    case "functionType":
      for (const parameter of type.parameters) {
        collectReferencedPortableTypeNames(
          parameter.type,
          typeParametersInScope,
          out
        );
      }
      collectReferencedPortableTypeNames(
        type.returnType,
        typeParametersInScope,
        out
      );
      return;
    case "objectType":
      for (const member of type.members) {
        if (member.kind === "propertySignature") {
          collectReferencedPortableTypeNames(
            member.type,
            typeParametersInScope,
            out
          );
          continue;
        }
        const nestedTypeParameters = new Set(typeParametersInScope);
        for (const typeParameter of member.typeParameters ?? []) {
          nestedTypeParameters.add(typeParameter.name);
        }
        for (const parameter of member.parameters) {
          collectReferencedPortableTypeNames(
            parameter.type,
            nestedTypeParameters,
            out
          );
        }
        collectReferencedPortableTypeNames(
          member.returnType,
          nestedTypeParameters,
          out
        );
      }
      return;
    case "referenceType":
      out.add(
        renderReferenceType(type.name, type.typeArguments, []).split("<")[0]!
      );
      for (const typeArgument of type.typeArguments ?? []) {
        collectReferencedPortableTypeNames(
          typeArgument,
          typeParametersInScope,
          out
        );
      }
      return;
  }
};

const collectReferencedPortableTypesFromParameters = (
  parameters: readonly IrParameter[],
  typeParametersInScope: ReadonlySet<string>,
  out: Set<string>
): void => {
  for (const parameter of parameters) {
    collectReferencedPortableTypeNames(
      parameter.type,
      typeParametersInScope,
      out
    );
  }
};

const collectReferencedPortableTypeNamesFromDeclaration = (
  declaration:
    | IrClassDeclaration
    | IrInterfaceDeclaration
    | IrEnumDeclaration
    | IrTypeAliasDeclaration,
  out: Set<string>
): void => {
  switch (declaration.kind) {
    case "enumDeclaration":
      return;
    case "typeAliasDeclaration": {
      const typeParametersInScope = new Set(
        (declaration.typeParameters ?? []).map((typeParameter) => typeParameter.name)
      );
      collectReferencedPortableTypeNames(
        declaration.type,
        typeParametersInScope,
        out
      );
      return;
    }
    case "interfaceDeclaration": {
      const typeParametersInScope = new Set(
        (declaration.typeParameters ?? []).map((typeParameter) => typeParameter.name)
      );
      for (const baseType of declaration.extends) {
        collectReferencedPortableTypeNames(
          baseType,
          typeParametersInScope,
          out
        );
      }
      for (const member of declaration.members) {
        if (member.kind === "propertySignature") {
          collectReferencedPortableTypeNames(
            member.type,
            typeParametersInScope,
            out
          );
          continue;
        }
        const nestedTypeParameters = new Set(typeParametersInScope);
        for (const typeParameter of member.typeParameters ?? []) {
          nestedTypeParameters.add(typeParameter.name);
        }
        collectReferencedPortableTypesFromParameters(
          member.parameters,
          nestedTypeParameters,
          out
        );
        collectReferencedPortableTypeNames(
          member.returnType,
          nestedTypeParameters,
          out
        );
      }
      return;
    }
    case "classDeclaration": {
      const typeParametersInScope = new Set(
        (declaration.typeParameters ?? []).map((typeParameter) => typeParameter.name)
      );
      if (declaration.superClass) {
        collectReferencedPortableTypeNames(
          declaration.superClass,
          typeParametersInScope,
          out
        );
      }
      for (const implementedType of declaration.implements) {
        collectReferencedPortableTypeNames(
          implementedType,
          typeParametersInScope,
          out
        );
      }
      for (const member of declaration.members) {
        switch (member.kind) {
          case "constructorDeclaration":
            collectReferencedPortableTypesFromParameters(
              member.parameters,
              typeParametersInScope,
              out
            );
            continue;
          case "propertyDeclaration":
            collectReferencedPortableTypeNames(
              member.type,
              typeParametersInScope,
              out
            );
            continue;
          case "methodDeclaration": {
            const nestedTypeParameters = new Set(typeParametersInScope);
            for (const typeParameter of member.typeParameters ?? []) {
              nestedTypeParameters.add(typeParameter.name);
            }
            collectReferencedPortableTypesFromParameters(
              member.parameters,
              nestedTypeParameters,
              out
            );
            collectReferencedPortableTypeNames(
              member.returnType,
              nestedTypeParameters,
              out
            );
            continue;
          }
        }
      }
      return;
    }
  }
};

const classifyLocalTypeDeclarationKind = (
  statement: IrStatement
): InternalHelperTypeKind | undefined => {
  switch (statement.kind) {
    case "classDeclaration":
      return "class";
    case "interfaceDeclaration":
      return "interface";
    case "enumDeclaration":
      return "enum";
    case "typeAliasDeclaration":
      return "typeAlias";
    default:
      return undefined;
  }
};

const declarationNameOf = (statement: IrStatement): string | undefined => {
  switch (statement.kind) {
    case "functionDeclaration":
    case "classDeclaration":
    case "interfaceDeclaration":
    case "enumDeclaration":
    case "typeAliasDeclaration":
      return statement.name;
    default:
      return undefined;
  }
};

const resolveModuleLocalDeclaration = (
  module: IrModule,
  localName: string
): IrStatement | undefined => {
  for (const statement of module.body) {
    const statementName = declarationNameOf(statement);
    if (statementName === localName) return statement;

    if (statement.kind === "variableDeclaration") {
      for (const declarator of statement.declarations) {
        if (
          declarator.name.kind === "identifierPattern" &&
          declarator.name.name === localName
        ) {
          return statement;
        }
      }
    }
  }
  return undefined;
};

const classifyDeclarationKind = (
  statement: IrStatement,
  filePath: string,
  exportName: string
): Result<ExportedSymbolKind, string> => {
  switch (statement.kind) {
    case "functionDeclaration":
      return { ok: true, value: "function" };
    case "variableDeclaration":
      return { ok: true, value: "variable" };
    case "classDeclaration":
      return { ok: true, value: "class" };
    case "interfaceDeclaration":
      return { ok: true, value: "interface" };
    case "enumDeclaration":
      return { ok: true, value: "enum" };
    case "typeAliasDeclaration":
      return { ok: true, value: "typeAlias" };
    default:
      return {
        ok: false,
        error:
          `Unsupported export '${exportName}' in ${filePath}: ${statement.kind}.\n` +
          "First-party bindings generation requires explicit support for each exported declaration kind.",
      };
  }
};

const collectModuleExports = (
  module: IrModule,
  modulesByFileKey: ReadonlyMap<string, IrModule>
): Result<readonly ExportedSymbol[], string> => {
  const exportedSymbols: ExportedSymbol[] = [];
  const seen = new Set<string>();

  const pushExport = (symbol: ExportedSymbol): void => {
    const key = `${symbol.exportName}|${symbol.localName}|${symbol.kind}`;
    if (seen.has(key)) return;
    seen.add(key);
    exportedSymbols.push(symbol);
  };

  for (const item of module.exports) {
    if (item.kind === "default") {
      return {
        ok: false,
        error:
          `Unsupported default export in ${module.filePath}.\n` +
          "First-party bindings generation currently requires named/declaration exports for deterministic namespace facades.",
      };
    }

    if (item.kind === "declaration") {
      const declaration = item.declaration;
      if (declaration.kind === "variableDeclaration") {
        for (const declarator of declaration.declarations) {
          if (declarator.name.kind !== "identifierPattern") {
            return {
              ok: false,
              error:
                `Unsupported exported variable declarator in ${module.filePath}: ${declarator.name.kind}.\n` +
                "First-party bindings generation requires identifier-based exported variables.",
            };
          }
          const localName = declarator.name.name;
          pushExport({
            exportName: localName,
            localName,
            kind: "variable",
            declaration,
            declaringNamespace: module.namespace,
            declaringClassName: module.className,
            declaringFilePath: module.filePath,
          });
        }
        continue;
      }

      const declarationName = declarationNameOf(declaration);
      if (!declarationName) {
        return {
          ok: false,
          error:
            `Unsupported exported declaration in ${module.filePath}: ${declaration.kind}.\n` +
            "First-party bindings generation requires explicit support for each exported declaration kind.",
        };
      }
      const declarationKind = classifyDeclarationKind(
        declaration,
        module.filePath,
        declarationName
      );
      if (!declarationKind.ok) return declarationKind;
      pushExport({
        exportName: declarationName,
        localName: declarationName,
        kind: declarationKind.value,
        declaration,
        declaringNamespace: module.namespace,
        declaringClassName: module.className,
        declaringFilePath: module.filePath,
      });
      continue;
    }

    if (item.kind === "reexport") continue;

    const resolved = resolveExportedDeclaration(
      module,
      item.name,
      modulesByFileKey
    );
    if (!resolved.ok) return resolved;
    const declaration = resolved.value.declaration;
    const declarationName = declarationNameOf(declaration);
    if (!declarationName && declaration.kind !== "variableDeclaration") {
      return {
        ok: false,
        error:
          `Unsupported named export '${item.name}' in ${module.filePath}: ${declaration.kind}.\n` +
          "First-party bindings generation requires explicit support for each exported declaration kind.",
      };
    }
    const declarationKind = classifyDeclarationKind(
      declaration,
      module.filePath,
      item.name
    );
    if (!declarationKind.ok) return declarationKind;
    pushExport({
      exportName: item.name,
      localName: resolved.value.clrName,
      kind: declarationKind.value,
      declaration,
      declaringNamespace: resolved.value.module.namespace,
      declaringClassName: resolved.value.module.className,
      declaringFilePath: resolved.value.module.filePath,
    });
  }

  return {
    ok: true,
    value: exportedSymbols.sort((left, right) =>
      left.exportName.localeCompare(right.exportName)
    ),
  };
};

const finalizeCrossNamespaceReexports = (
  grouped: ReadonlyMap<string, readonly string[]>
): {
  readonly dtsStatements: readonly string[];
  readonly jsValueStatements: readonly string[];
} => {
  const dtsStatements: string[] = [];
  const jsValueStatements: string[] = [];

  for (const [key, specs] of Array.from(grouped.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    const [moduleSpecifier, kind] = key.split("|") as [
      string,
      "type" | "value",
    ];
    const unique = Array.from(new Set(specs)).sort((a, b) =>
      a.localeCompare(b)
    );
    if (kind === "type") {
      dtsStatements.push(
        `export type { ${unique.join(", ")} } from '${moduleSpecifier}';`
      );
      continue;
    }
    const statement = `export { ${unique.join(", ")} } from '${moduleSpecifier}';`;
    dtsStatements.push(statement);
    jsValueStatements.push(statement);
  }

  return { dtsStatements, jsValueStatements };
};

const moduleNamespacePath = (namespace: string): string => {
  return namespace.length > 0 ? namespace : "index";
};

const normalizeModuleFileKey = (filePath: string): string => {
  return filePath
    .replace(/\\/g, "/")
    .replace(/^(\.\/)+/, "")
    .replace(/^\/+/, "");
};

const resolveLocalModuleFile = (
  fromModule: string,
  fromFile: string,
  modulesByFile: ReadonlyMap<string, IrModule>
): IrModule | undefined => {
  const dir = posix.dirname(fromFile);

  const candidates: string[] = [];
  const raw = fromModule.startsWith("/")
    ? posix.normalize(fromModule.slice(1))
    : posix.normalize(posix.join(dir, fromModule));
  candidates.push(raw);

  if (raw.endsWith(".js")) {
    candidates.push(raw.replace(/\.js$/, ".ts"));
  }

  if (!raw.endsWith(".ts") && !raw.endsWith(".js")) {
    candidates.push(raw + ".ts");
    candidates.push(raw + ".js");
    candidates.push(posix.join(raw, "index.ts"));
    candidates.push(posix.join(raw, "index.js"));
  }

  for (const cand of candidates) {
    const normalized = normalizeModuleFileKey(cand);
    const found = modulesByFile.get(normalized);
    if (found) return found;
  }

  return undefined;
};

const resolveReexportModuleKey = (
  fromFilePath: string,
  fromModule: string
): string => {
  const fromDir = posix.dirname(normalizeModuleFileKey(fromFilePath));
  return normalizeModuleFileKey(
    posix.normalize(posix.join(fromDir, fromModule))
  );
};

const isRelativeModuleSpecifier = (specifier: string): boolean =>
  specifier.startsWith(".") || specifier.startsWith("/");

const resolveImportedLocalDeclaration = (
  module: IrModule,
  localName: string,
  modulesByFileKey: ReadonlyMap<string, IrModule>,
  visited: ReadonlySet<string>
): Result<ResolvedExportDeclaration, string> => {
  for (const importEntry of module.imports) {
    for (const specifier of importEntry.specifiers) {
      if (specifier.localName !== localName) continue;
      if (specifier.kind === "namespace") {
        return {
          ok: false,
          error: `Unable to re-export '${localName}' from ${module.filePath}: namespace imports are not supported for first-party bindings generation.`,
        };
      }
      if (!importEntry.isLocal) {
        return {
          ok: false,
          error:
            `Unsupported re-export in ${module.filePath}: '${localName}' resolves to non-local module '${importEntry.source}'.\n` +
            "First-party bindings generation currently supports only local source-module exports.",
        };
      }
      const targetModule = modulesByFileKey.get(
        resolveReexportModuleKey(module.filePath, importEntry.source)
      );
      if (!targetModule) {
        return {
          ok: false,
          error:
            `Unable to resolve local import target for '${localName}' in ${module.filePath}: '${importEntry.source}'.\n` +
            "First-party bindings generation requires local import targets to resolve deterministically.",
        };
      }
      const importedName =
        specifier.kind === "named" ? specifier.name : "default";
      return resolveExportedDeclaration(
        targetModule,
        importedName,
        modulesByFileKey,
        visited
      );
    }
  }
  return {
    ok: false,
    error:
      `Unable to resolve local symbol '${localName}' in ${module.filePath}.\n` +
      "First-party bindings generation requires resolvable local exports and aliases.",
  };
};

const resolveExportedDeclaration = (
  module: IrModule,
  exportName: string,
  modulesByFileKey: ReadonlyMap<string, IrModule>,
  visited: ReadonlySet<string> = new Set()
): Result<ResolvedExportDeclaration, string> => {
  const cycleKey = `${normalizeModuleFileKey(module.filePath)}::${exportName}`;
  if (visited.has(cycleKey)) {
    return {
      ok: false,
      error:
        `Cyclic re-export detected while resolving '${exportName}' in ${module.filePath}.\n` +
        "First-party bindings generation requires acyclic local re-export graphs.",
    };
  }
  const nextVisited = new Set(visited);
  nextVisited.add(cycleKey);

  for (const item of module.exports) {
    if (item.kind === "declaration") {
      const declaration = item.declaration;
      if (declaration.kind === "variableDeclaration") {
        for (const declarator of declaration.declarations) {
          if (declarator.name.kind !== "identifierPattern") continue;
          if (declarator.name.name !== exportName) continue;
          return {
            ok: true,
            value: {
              declaration,
              module,
              clrName: declarator.name.name,
            },
          };
        }
        continue;
      }
      const declarationName = declarationNameOf(declaration);
      if (declarationName !== exportName) continue;
      return {
        ok: true,
        value: {
          declaration,
          module,
          clrName: declarationName,
        },
      };
    }

    if (item.kind === "named") {
      if (item.name !== exportName) continue;
      const declaration = resolveModuleLocalDeclaration(module, item.localName);
      if (declaration) {
        return {
          ok: true,
          value: {
            declaration,
            module,
            clrName: item.localName,
          },
        };
      }
      return resolveImportedLocalDeclaration(
        module,
        item.localName,
        modulesByFileKey,
        nextVisited
      );
    }

    if (item.kind === "reexport") {
      if (item.name !== exportName) continue;
      if (!isRelativeModuleSpecifier(item.fromModule)) {
        return {
          ok: false,
          error:
            `Unsupported re-export in ${module.filePath}: '${item.name}' from '${item.fromModule}'.\n` +
            "First-party bindings generation currently supports only relative re-exports from local source modules.",
        };
      }
      const targetModule = modulesByFileKey.get(
        resolveReexportModuleKey(module.filePath, item.fromModule)
      );
      if (!targetModule) {
        return {
          ok: false,
          error:
            `Unable to resolve local re-export target for '${item.name}' in ${module.filePath}: '${item.fromModule}'.\n` +
            "First-party bindings generation requires local re-export targets to resolve deterministically.",
        };
      }
      return resolveExportedDeclaration(
        targetModule,
        item.originalName,
        modulesByFileKey,
        nextVisited
      );
    }

    if (item.kind === "default" && exportName === "default") {
      return {
        ok: false,
        error:
          `Unsupported default export in ${module.filePath}.\n` +
          "First-party bindings generation currently requires named/declaration exports for deterministic namespace facades.",
      };
    }
  }

  return {
    ok: false,
    error:
      `Unable to resolve exported symbol '${exportName}' in ${module.filePath}.\n` +
      "First-party bindings generation requires explicit resolvable exports.",
  };
};

const buildModuleSourceIndex = (
  absoluteFilePath: string,
  fileKey: string
): Result<ModuleSourceIndex, string> => {
  if (!existsSync(absoluteFilePath)) {
    return {
      ok: false,
      error: `Failed to read source file for bindings generation: ${absoluteFilePath}`,
    };
  }

  const content = readFileSync(absoluteFilePath, "utf-8");
  const scriptKind = absoluteFilePath.endsWith(".tsx")
    ? ts.ScriptKind.TSX
    : absoluteFilePath.endsWith(".js")
      ? ts.ScriptKind.JS
      : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    absoluteFilePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    scriptKind
  );

  const wrapperImportsByLocalName = new Map<string, SourceTypeImport>();
  const typeImportsByLocalName = new Map<string, SourceTypeImport>();
  const typeAliasesByName = new Map<string, SourceTypeAliasDef>();
  const exportedTypeDeclarationNames = new Set<string>();
  const exportedFunctionSignaturesByName = new Map<
    string,
    SourceFunctionSignatureDef[]
  >();
  const exportedValueTypesByName = new Map<string, SourceValueTypeDef>();
  const memberTypesByClassAndMember = new Map<
    string,
    Map<string, SourceMemberTypeDef>
  >();

  const printTypeParametersText = (
    typeParameters: readonly ts.TypeParameterDeclaration[] | undefined
  ): string => {
    if (!typeParameters || typeParameters.length === 0) return "";
    return `<${typeParameters.map((tp) => tp.getText(sourceFile)).join(", ")}>`;
  };

  const printParameterSignature = (
    param: ts.ParameterDeclaration
  ): { readonly prefixText: string; readonly typeText: string } => {
    const rest = param.dotDotDotToken ? "..." : "";
    const name = param.name.getText(sourceFile);
    const optional = param.questionToken ? "?" : "";
    return {
      prefixText: `${rest}${name}${optional}: `,
      typeText: param.type ? printTypeNodeText(param.type, sourceFile) : "unknown",
    };
  };

  const addExportedFunctionSignature = (
    name: string,
    signature: SourceFunctionSignatureDef
  ): void => {
    const signatures = exportedFunctionSignaturesByName.get(name) ?? [];
    signatures.push(signature);
    exportedFunctionSignaturesByName.set(name, signatures);
  };

  for (const stmt of sourceFile.statements) {
    if (ts.isImportDeclaration(stmt)) {
      const moduleSpecifier = ts.isStringLiteral(stmt.moduleSpecifier)
        ? stmt.moduleSpecifier.text
        : undefined;
      if (!moduleSpecifier) continue;

      const clause = stmt.importClause;
      if (!clause) continue;

      const namedBindings = clause.namedBindings;
      if (!namedBindings || !ts.isNamedImports(namedBindings)) continue;

      for (const spec of namedBindings.elements) {
        const localName = spec.name.text;
        const importedName = (spec.propertyName ?? spec.name).text;
        typeImportsByLocalName.set(localName, {
          source: moduleSpecifier,
          importedName,
        });
        if (importedName === "ExtensionMethods") {
          wrapperImportsByLocalName.set(localName, {
            source: moduleSpecifier,
            importedName,
          });
        }
      }
      continue;
    }

    if (ts.isTypeAliasDeclaration(stmt)) {
      const aliasName = stmt.name.text;
      const hasExport = stmt.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
      );
      const typeParameterNames = (stmt.typeParameters ?? []).map(
        (tp) => tp.name.text
      );
      typeAliasesByName.set(aliasName, {
        typeParametersText: printTypeParametersText(stmt.typeParameters),
        typeParameterNames,
        type: stmt.type,
        typeText: printTypeNodeText(stmt.type, sourceFile),
      });
      if (hasExport) {
        exportedTypeDeclarationNames.add(aliasName);
      }
      continue;
    }

    if (ts.isFunctionDeclaration(stmt)) {
      const hasExport = stmt.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
      );
      if (!hasExport || !stmt.name || !stmt.type) continue;
      const parameters = stmt.parameters.map(printParameterSignature);
      addExportedFunctionSignature(stmt.name.text, {
        typeParametersText: printTypeParametersText(stmt.typeParameters),
        typeParameterCount: stmt.typeParameters?.length ?? 0,
        parameters,
        returnTypeText: printTypeNodeText(stmt.type, sourceFile),
      });
      continue;
    }

    if (ts.isVariableStatement(stmt)) {
      const hasExport = stmt.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
      );
      if (!hasExport) continue;
      for (const declaration of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) continue;
        const exportName = declaration.name.text;
        const initializer = declaration.initializer;
        if (!initializer) continue;
        if (
          !ts.isArrowFunction(initializer) &&
          !ts.isFunctionExpression(initializer)
        ) {
          if (declaration.type) {
            exportedValueTypesByName.set(exportName, {
              typeText: printTypeNodeText(declaration.type, sourceFile),
            });
          }
          continue;
        }
        if (!initializer.type) continue;
        const parameters = initializer.parameters.map(printParameterSignature);
        addExportedFunctionSignature(exportName, {
          typeParametersText: printTypeParametersText(
            initializer.typeParameters
          ),
          typeParameterCount: initializer.typeParameters?.length ?? 0,
          parameters,
          returnTypeText: printTypeNodeText(initializer.type, sourceFile),
        });
      }
      continue;
    }

    if (ts.isClassDeclaration(stmt) && stmt.name) {
      const className = stmt.name.text;
      const hasExport = stmt.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
      );
      if (hasExport) {
        exportedTypeDeclarationNames.add(className);
      }
      const members =
        memberTypesByClassAndMember.get(className) ??
        new Map<string, SourceMemberTypeDef>();

      for (const member of stmt.members) {
        if (ts.isGetAccessorDeclaration(member)) {
          if (!member.name || !member.type) continue;
          const name = getPropertyNameText(member.name);
          if (!name) continue;
          members.set(name, {
            typeNode: member.type,
            typeText: printTypeNodeText(member.type, sourceFile),
            isOptional: false,
          });
          continue;
        }

        if (ts.isPropertyDeclaration(member)) {
          if (!member.name || !member.type) continue;
          const name = getPropertyNameText(member.name);
          if (!name) continue;
          members.set(name, {
            typeNode: member.type,
            typeText: printTypeNodeText(member.type, sourceFile),
            isOptional: member.questionToken !== undefined,
          });
        }
      }

      if (members.size > 0) {
        memberTypesByClassAndMember.set(className, members);
      }
      continue;
    }

    if (ts.isInterfaceDeclaration(stmt)) {
      const interfaceName = stmt.name.text;
      const hasExport = stmt.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
      );
      if (hasExport) {
        exportedTypeDeclarationNames.add(interfaceName);
      }
      const members =
        memberTypesByClassAndMember.get(interfaceName) ??
        new Map<string, SourceMemberTypeDef>();

      for (const member of stmt.members) {
        if (!ts.isPropertySignature(member)) continue;
        if (!member.name || !member.type) continue;
        const name = getPropertyNameText(member.name);
        if (!name) continue;

        members.set(name, {
          typeNode: member.type,
          typeText: printTypeNodeText(member.type, sourceFile),
          isOptional: member.questionToken !== undefined,
        });
      }

      if (members.size > 0) {
        memberTypesByClassAndMember.set(interfaceName, members);
      }
      continue;
    }

    if (ts.isEnumDeclaration(stmt)) {
      const hasExport = stmt.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
      );
      if (hasExport) {
        exportedTypeDeclarationNames.add(stmt.name.text);
      }
    }
  }

  return {
    ok: true,
    value: {
      fileKey,
      wrapperImportsByLocalName,
      typeImportsByLocalName,
      typeAliasesByName,
      exportedTypeDeclarationNames,
      exportedFunctionSignaturesByName,
      exportedValueTypesByName,
      memberTypesByClassAndMember,
    },
  };
};

const typeNodeUsesImportedTypeNames = (
  node: ts.TypeNode,
  typeImportsByLocalName: ReadonlyMap<string, SourceTypeImport>
): boolean => {
  const allowlistedImportSources = new Set<string>(["@tsonic/core/types.js"]);

  let found = false;
  const visit = (current: ts.Node): void => {
    if (found) return;
    if (ts.isTypeReferenceNode(current) && ts.isIdentifier(current.typeName)) {
      const imported = typeImportsByLocalName.get(current.typeName.text);
      if (imported && !allowlistedImportSources.has(imported.source.trim())) {
        found = true;
        return;
      }
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return found;
};

const unwrapParens = (node: ts.TypeNode): ts.TypeNode => {
  let current = node;
  while (ts.isParenthesizedTypeNode(current)) {
    current = current.type;
  }
  return current;
};

const collectExtensionWrapperImportsFromSourceType = (opts: {
  readonly startModuleKey: string;
  readonly typeNode: ts.TypeNode;
  readonly sourceIndexByFileKey: ReadonlyMap<string, ModuleSourceIndex>;
  readonly modulesByFileKey: ReadonlyMap<string, IrModule>;
}): Result<readonly WrapperImport[], string> => {
  const wrappers: WrapperImport[] = [];

  let currentModuleKey = opts.startModuleKey;
  let currentNode: ts.TypeNode = opts.typeNode;
  let subst = new Map<string, ts.TypeNode>();
  const aliasStack: string[] = [];

  while (true) {
    currentNode = unwrapParens(currentNode);
    if (!ts.isTypeReferenceNode(currentNode)) break;
    if (!ts.isIdentifier(currentNode.typeName)) break;

    const ident = currentNode.typeName.text;
    const info = opts.sourceIndexByFileKey.get(currentModuleKey);
    if (!info) break;

    const substituted = subst.get(ident);
    if (substituted) {
      currentNode = substituted;
      continue;
    }

    const expandAlias = (
      aliasKey: string,
      alias: SourceTypeAliasDef,
      typeArgs: readonly ts.TypeNode[]
    ): void => {
      if (aliasStack.includes(aliasKey)) return;
      aliasStack.push(aliasKey);

      if (alias.typeParameterNames.length === typeArgs.length) {
        const next = new Map(subst);
        for (let i = 0; i < alias.typeParameterNames.length; i += 1) {
          const paramName = alias.typeParameterNames[i];
          const arg = typeArgs[i];
          if (!paramName || !arg) continue;
          next.set(paramName, arg);
        }
        subst = next;
      }

      currentNode = alias.type;
    };

    const localAlias = info.typeAliasesByName.get(ident);
    if (localAlias) {
      expandAlias(
        `${currentModuleKey}:${ident}`,
        localAlias,
        currentNode.typeArguments ?? []
      );
      continue;
    }

    const imported = info.typeImportsByLocalName.get(ident);
    if (
      imported &&
      (imported.source.startsWith(".") || imported.source.startsWith("/"))
    ) {
      const targetModule = resolveLocalModuleFile(
        imported.source,
        currentModuleKey,
        opts.modulesByFileKey
      );
      if (targetModule) {
        const targetKey = normalizeModuleFileKey(targetModule.filePath);
        const targetInfo = opts.sourceIndexByFileKey.get(targetKey);
        const targetAlias = targetInfo?.typeAliasesByName.get(
          imported.importedName
        );
        if (targetAlias) {
          currentModuleKey = targetKey;
          expandAlias(
            `${targetKey}:${imported.importedName}`,
            targetAlias,
            currentNode.typeArguments ?? []
          );
          continue;
        }
      }
    }

    const wrapperImport = info.wrapperImportsByLocalName.get(ident);
    if (!wrapperImport) break;
    const args = currentNode.typeArguments ?? [];
    if (args.length !== 1) {
      return {
        ok: false,
        error:
          `ExtensionMethods wrapper '${ident}' must have exactly 1 type argument.\n` +
          `Found: ${args.length} in ${currentModuleKey}.`,
      };
    }

    wrappers.push({
      source: wrapperImport.source,
      importedName: wrapperImport.importedName,
      localName: ident,
      aliasName: `__TsonicExt_${ident}`,
    });

    const nextNode = args[0];
    if (!nextNode) {
      return {
        ok: false,
        error: `ExtensionMethods wrapper '${ident}' is missing its type argument in ${currentModuleKey}.`,
      };
    }
    currentNode = nextNode;
  }

  return { ok: true, value: wrappers };
};

const moduleNamespaceToInternalSpecifier = (namespace: string): string => {
  const nsPath = moduleNamespacePath(namespace);
  return `./${nsPath}/internal/index.js`;
};

const toClrTypeName = (
  namespace: string,
  typeName: string,
  arity?: number
): string => {
  const suffix = arity && arity > 0 ? `\`${arity}` : "";
  return `${namespace}.${typeName}${suffix}`;
};

const toBindingTypeAlias = (
  namespace: string,
  typeName: string,
  arity?: number
): string => {
  const normalizedName = normalizeTypeReferenceName(typeName, arity);
  return namespace.length > 0 ? `${namespace}.${normalizedName}` : normalizedName;
};

const toStableId = (assemblyName: string, clrName: string): string => {
  return `${assemblyName}:${clrName}`;
};

const primitiveSignatureType = (name: string): string => {
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

const isNumericValueType = (name: string): boolean => {
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

const toSignatureType = (
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
      return toSignatureType(type.types[0], typeParametersInScope, localTypeNameRemaps);
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

const buildParameterModifiers = (
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

const makeMethodBinding = (opts: {
  readonly declaringClrType: string;
  readonly declaringAssemblyName: string;
  readonly methodName: string;
  readonly parameters: readonly IrParameter[];
  readonly returnType: IrType | undefined;
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

const renderClassInternal = (
  declaration: IrClassDeclaration,
  namespace: string,
  memberOverrides: ReadonlyMap<string, MemberOverride>,
  emittedName = declaration.name,
  localTypeNameRemaps: ReadonlyMap<string, string> = new Map(),
  brandName = declaration.name,
  bindingAlias = declaration.name
): readonly string[] => {
  const lines: string[] = [];
  const isSyntheticAnonymousStructuralClass =
    emittedName.startsWith("__Anon_") || brandName.startsWith("__Anon_");
  const typeParameterScope = (declaration.typeParameters ?? []).map(
    (typeParameter) => typeParameter.name
  );
  const typeParameters = printTypeParameters(declaration.typeParameters);
  const markerName = `__tsonic_type_${sanitizeForBrand(namespace)}_${sanitizeForBrand(brandName)}`;
  const heritageNames = [
    declaration.superClass
      ? renderPortableType(
          declaration.superClass,
          typeParameterScope,
          localTypeNameRemaps
        )
      : undefined,
    ...declaration.implements.map((implementedType) =>
      renderPortableType(
        implementedType,
        typeParameterScope,
        localTypeNameRemaps
      )
    ),
  ]
    .filter((name): name is string => name !== undefined)
    .map((name) => name.trim())
    .filter(
      (name) =>
        name.length > 0 &&
        name !== "unknown" &&
        name !== "never" &&
        name !== "void"
    );
  const extendsClause =
    heritageNames.length > 0
      ? ` extends ${Array.from(new Set(heritageNames)).join(", ")}`
      : "";

  lines.push(
    `export interface ${emittedName}$instance${typeParameters}${extendsClause} {`
  );
  if (!isSyntheticAnonymousStructuralClass) {
    lines.push(`    readonly ${markerName}: never;`);
  }
  lines.push(renderBindingAliasMarker(namespace, bindingAlias));

  const instanceMembers = declaration.members.filter((member) => {
    if (member.kind === "constructorDeclaration") return false;
    if ("isStatic" in member && member.isStatic) return false;
    return true;
  });

  for (const member of instanceMembers) {
    if (member.kind === "methodDeclaration") {
      lines.push(
        `    ${renderMethodSignature(
          member.name,
          member.typeParameters,
          member.parameters,
          member.returnType,
          localTypeNameRemaps
        )}`
      );
      continue;
    }
    if (member.kind === "propertyDeclaration") {
      const memberOverride = memberOverrides.get(member.name);
      const hasAccessorBody =
        member.getterBody !== undefined || member.setterBody !== undefined;
      const hasGetter = hasAccessorBody
        ? member.getterBody !== undefined
        : true;
      const hasSetter = hasAccessorBody
        ? member.setterBody !== undefined
        : !member.isReadonly;
      const baseType =
        (memberOverride?.replaceWithSourceType
          ? memberOverride.sourceTypeText
          : undefined) ??
        renderPortableType(
          member.type,
          typeParameterScope,
          localTypeNameRemaps
        );
      const wrappedType = applyWrappersToBaseType(
        baseType,
        memberOverride?.wrappers ?? []
      );
      const memberType =
        memberOverride?.isOptional === true
          ? ensureUndefinedInType(wrappedType)
          : wrappedType;

      if (hasGetter && !hasSetter) {
        lines.push(`    readonly ${member.name}: ${memberType};`);
        continue;
      }
      lines.push(`    ${member.name}: ${memberType};`);
    }
  }

  lines.push("}");
  lines.push("");
  if (isSyntheticAnonymousStructuralClass) {
    lines.push(
      `export type ${emittedName}${typeParameters} = ${emittedName}$instance${typeParameters};`
    );
    return lines;
  }
  lines.push(`export const ${emittedName}: {`);
  lines.push(
    `    new(...args: unknown[]): ${emittedName}${typeParameters};`
  );

  const staticMembers = declaration.members.filter((member) => {
    if (member.kind === "constructorDeclaration") return false;
    return "isStatic" in member && member.isStatic;
  });

  for (const member of staticMembers) {
    if (member.kind === "methodDeclaration") {
      lines.push(
        `    ${renderMethodSignature(
          member.name,
          member.typeParameters,
          member.parameters,
          member.returnType,
          localTypeNameRemaps
        )}`
      );
      continue;
    }
    if (member.kind === "propertyDeclaration") {
      lines.push(
        `    ${member.name}: ${renderPortableType(
          member.type,
          typeParameterScope,
          localTypeNameRemaps
        )};`
      );
    }
  }

  lines.push("};");
  lines.push("");
  lines.push(
    `export type ${emittedName}${typeParameters} = ${emittedName}$instance${typeParameters};`
  );
  lines.push("");

  return lines;
};

const renderInterfaceInternal = (
  declaration: IrInterfaceDeclaration,
  namespace: string,
  memberOverrides: ReadonlyMap<string, MemberOverride>,
  emittedName = declaration.name,
  localTypeNameRemaps: ReadonlyMap<string, string> = new Map(),
  brandName = declaration.name,
  bindingAlias = declaration.name
): readonly string[] => {
  const lines: string[] = [];
  const typeParameterScope = (declaration.typeParameters ?? []).map(
    (typeParameter) => typeParameter.name
  );
  const typeParameters = printTypeParameters(declaration.typeParameters);
  const markerName = `__tsonic_type_${sanitizeForBrand(namespace)}_${sanitizeForBrand(brandName)}`;
  const extendsNames = declaration.extends
    .map((baseType) =>
      renderPortableType(
        baseType,
        typeParameterScope,
        localTypeNameRemaps
      ).trim()
    )
    .filter(
      (name) =>
        name.length > 0 &&
        name !== "unknown" &&
        name !== "never" &&
        name !== "void"
    );
  const extendsClause =
    extendsNames.length > 0
      ? ` extends ${Array.from(new Set(extendsNames)).join(", ")}`
      : "";

  lines.push(
    `export interface ${emittedName}$instance${typeParameters}${extendsClause} {`
  );
  lines.push(`    readonly ${markerName}?: never;`);
  lines.push(renderBindingAliasMarker(namespace, bindingAlias));
  for (const member of declaration.members) {
    if (member.kind === "methodSignature") {
      lines.push(
        `    ${renderMethodSignature(
          member.name,
          member.typeParameters,
          member.parameters,
          member.returnType,
          localTypeNameRemaps
        )}`
      );
      continue;
    }
    if (member.kind === "propertySignature") {
      const memberOverride = memberOverrides.get(member.name);
      const optionalBySource =
        memberOverride?.emitOptionalPropertySyntax === true &&
        memberOverride.isOptional === true &&
        !member.name.startsWith("__tsonic_type_");
      const optionalMark = optionalBySource || member.isOptional ? "?" : "";
      const baseType =
        (memberOverride?.replaceWithSourceType
          ? memberOverride.sourceTypeText
          : undefined) ??
        renderPortableType(member.type, typeParameterScope, localTypeNameRemaps);
      const wrappedType = applyWrappersToBaseType(
        baseType,
        memberOverride?.wrappers ?? []
      );
      const memberType =
        memberOverride?.isOptional && !optionalBySource
          ? ensureUndefinedInType(wrappedType)
          : wrappedType;
      lines.push(`    ${member.name}${optionalMark}: ${memberType};`);
    }
  }
  lines.push("}");
  lines.push("");
  lines.push(
    `export type ${emittedName}${typeParameters} = ${emittedName}$instance${typeParameters};`
  );
  lines.push("");
  return lines;
};

const renderEnumInternal = (
  declaration: IrEnumDeclaration,
  emittedName = declaration.name
): readonly string[] => {
  const lines: string[] = [];
  lines.push(`export enum ${emittedName} {`);
  declaration.members.forEach((member, index) => {
    lines.push(`    ${member.name} = ${index},`);
  });
  lines.push("}");
  lines.push("");
  return lines;
};

const renderStructuralAliasInternal = (
  declaration: IrTypeAliasDeclaration,
  namespace: string,
  memberOverrides: ReadonlyMap<string, MemberOverride>,
  emittedName = declaration.name,
  localTypeNameRemaps: ReadonlyMap<string, string> = new Map(),
  brandAliasName = `${declaration.name}__Alias${
    (declaration.typeParameters?.length ?? 0) > 0
      ? `_${declaration.typeParameters?.length ?? 0}`
      : ""
  }`,
  bindingAlias = `${declaration.name}__Alias${
    (declaration.typeParameters?.length ?? 0) > 0
      ? `_${declaration.typeParameters?.length ?? 0}`
      : ""
  }`
): readonly string[] => {
  if (declaration.type.kind !== "objectType") return [];

  const lines: string[] = [];
  const arity = declaration.typeParameters?.length ?? 0;
  const typeParameters = printTypeParameters(declaration.typeParameters);
  const typeParameterScope = (declaration.typeParameters ?? []).map(
    (typeParameter) => typeParameter.name
  );
  const internalAliasName = `${emittedName}__Alias${arity > 0 ? `_${arity}` : ""}`;
  const markerName = `__tsonic_type_${sanitizeForBrand(namespace)}_${sanitizeForBrand(brandAliasName)}`;

  lines.push(
    `export interface ${internalAliasName}$instance${typeParameters} {`
  );
  lines.push(`    readonly ${markerName}?: never;`);
  lines.push(renderBindingAliasMarker(namespace, bindingAlias));
  for (const member of declaration.type.members) {
    if (member.kind === "methodSignature") {
      lines.push(
        `    ${renderMethodSignature(
          member.name,
          member.typeParameters,
          member.parameters,
          member.returnType
        )}`
      );
      continue;
    }
    if (member.kind === "propertySignature") {
      const memberOverride = memberOverrides.get(member.name);
      const optionalMark = member.isOptional ? "?" : "";
      const baseType =
        (memberOverride?.replaceWithSourceType
          ? memberOverride.sourceTypeText
          : undefined) ??
        renderPortableType(
          member.type,
          typeParameterScope,
          localTypeNameRemaps
        );
      const wrappedType = applyWrappersToBaseType(
        baseType,
        memberOverride?.wrappers ?? []
      );
      const memberType =
        memberOverride?.isOptional === true
          ? ensureUndefinedInType(wrappedType)
          : wrappedType;
      lines.push(`    ${member.name}${optionalMark}: ${memberType};`);
    }
  }
  lines.push("}");
  lines.push("");
  lines.push(
    `export type ${internalAliasName}${typeParameters} = ${internalAliasName}$instance${typeParameters};`
  );
  lines.push("");
  return lines;
};

const renderTypeAliasInternal = (
  declaration: IrTypeAliasDeclaration,
  emittedName = declaration.name,
  localTypeNameRemaps: ReadonlyMap<string, string> = new Map()
): readonly string[] => {
  if (declaration.type.kind === "objectType") return [];

  const typeParameterScope = (declaration.typeParameters ?? []).map(
    (typeParameter) => typeParameter.name
  );
  const typeParameters = printTypeParameters(declaration.typeParameters);
  return [
    `export type ${emittedName}${typeParameters} = ${renderPortableType(
      declaration.type,
      typeParameterScope,
      localTypeNameRemaps
    )};`,
    "",
  ];
};

const renderContainerInternal = (
  entry: ModuleContainerEntry,
  anonymousStructuralAliases: ReadonlyMap<
    string,
    AnonymousStructuralAliasInfo
  >
): readonly string[] => {
  const lines: string[] = [];
  lines.push(`export abstract class ${entry.module.className}$instance {`);
  for (const method of entry.methods) {
    const sourceSignature = renderSourceFunctionSignature({
      declaration: method.declaration,
      sourceSignatures: method.sourceSignatures,
      localTypeNameRemaps: method.localTypeNameRemaps,
      anonymousStructuralAliases,
    });
    lines.push(
      `    static ${
        sourceSignature
          ? `${method.localName}${sourceSignature.typeParametersText}(${sourceSignature.parametersText}): ${sourceSignature.returnTypeText};`
          : renderMethodSignature(
              method.localName,
              method.declaration.typeParameters,
              method.declaration.parameters,
              method.declaration.returnType,
              method.localTypeNameRemaps
            )
      }`
    );
  }
  for (const variable of entry.variables) {
    const sourceFunctionTypeText = renderSourceFunctionType({
      sourceSignatures: variable.sourceSignatures,
      localTypeNameRemaps: variable.localTypeNameRemaps,
      anonymousStructuralAliases,
    });
    const sourceTypeText =
      sourceFunctionTypeText ??
      renderSourceValueType(
        variable.sourceType,
        variable.localTypeNameRemaps,
        anonymousStructuralAliases
      );
    lines.push(
      `    static ${variable.localName}: ${
        sourceTypeText ??
        renderPortableType(
          variable.declarator?.type,
          [],
          variable.localTypeNameRemaps
        )
      };`
    );
  }
  lines.push("}");
  lines.push("");
  lines.push(
    `export type ${entry.module.className} = ${entry.module.className}$instance;`
  );
  lines.push("");
  return lines;
};

const buildTypeBindingFromClass = (
  declaration: IrClassDeclaration,
  namespace: string,
  assemblyName: string,
  localTypeNameRemaps: ReadonlyMap<string, string> = new Map()
): FirstPartyBindingsType => {
  const declaringClrType = toClrTypeName(
    namespace,
    declaration.name,
    declaration.typeParameters?.length ?? 0
  );
  const typeStableId = toStableId(assemblyName, declaringClrType);
  const typeParameterScope =
    declaration.typeParameters?.map((typeParameter) => typeParameter.name) ??
    [];

  const methods: FirstPartyBindingsMethod[] = [];
  const properties: FirstPartyBindingsProperty[] = [];
  const constructors: FirstPartyBindingsConstructor[] = [];
  for (const member of declaration.members) {
    if (member.kind === "constructorDeclaration") {
      constructors.push({
        normalizedSignature: `.ctor|(${member.parameters
          .map((parameter) =>
            toSignatureType(
              parameter.type,
              typeParameterScope,
              localTypeNameRemaps
            )
          )
          .join(",")})|static=false`,
        isStatic: false,
        parameterCount: member.parameters.length,
      });
      continue;
    }

    if (member.kind === "methodDeclaration") {
      methods.push(
        makeMethodBinding({
          declaringClrType,
          declaringAssemblyName: assemblyName,
          methodName: member.name,
          parameters: member.parameters,
          returnType: member.returnType,
          arity: member.typeParameters?.length ?? 0,
          parameterModifiers: buildParameterModifiers(member.parameters),
          isStatic: member.isStatic,
          isAbstract: member.body === undefined,
          isVirtual: member.isVirtual,
          isOverride: member.isOverride,
          localTypeNameRemaps,
        })
      );
      continue;
    }

    if (member.kind === "propertyDeclaration") {
      const hasAccessorBody =
        member.getterBody !== undefined || member.setterBody !== undefined;
      const hasGetter = hasAccessorBody
        ? member.getterBody !== undefined
        : true;
      const hasSetter = hasAccessorBody
        ? member.setterBody !== undefined
        : !member.isReadonly;
      const propertyType = toSignatureType(
        member.type,
        typeParameterScope,
        localTypeNameRemaps
      );

      properties.push({
        stableId: `${typeStableId}::property:${member.name}`,
        clrName: member.name,
        normalizedSignature: `${member.name}|:${propertyType}|static=${
          member.isStatic ? "true" : "false"
        }|accessor=${hasGetter && hasSetter ? "getset" : hasSetter ? "set" : "get"}`,
        isStatic: member.isStatic,
        isAbstract:
          member.getterBody === undefined && member.setterBody === undefined
            ? false
            : false,
        isVirtual: member.isVirtual ?? false,
        isOverride: member.isOverride ?? false,
        isIndexer: false,
        hasGetter,
        hasSetter,
        declaringClrType,
        declaringAssemblyName: assemblyName,
      });
    }
  }

  return {
    stableId: typeStableId,
    clrName: declaringClrType,
    alias: toBindingTypeAlias(
      namespace,
      declaration.name,
      declaration.typeParameters?.length ?? 0
    ),
    assemblyName,
    kind: declaration.isStruct ? "Struct" : "Class",
    accessibility: "Public",
    isAbstract: false,
    isSealed: false,
    isStatic: false,
    arity: declaration.typeParameters?.length ?? 0,
    typeParameters:
      declaration.typeParameters?.map((typeParameter) => typeParameter.name) ??
      [],
    methods,
    properties,
    fields: [],
    events: [],
    constructors:
      constructors.length > 0
        ? constructors
        : [
            {
              normalizedSignature: ".ctor|()|static=false",
              isStatic: false,
              parameterCount: 0,
            },
          ],
  };
};

const buildTypeBindingFromInterface = (
  declaration: IrInterfaceDeclaration,
  namespace: string,
  assemblyName: string,
  localTypeNameRemaps: ReadonlyMap<string, string> = new Map()
): FirstPartyBindingsType => {
  const declaringClrType = toClrTypeName(
    namespace,
    declaration.name,
    declaration.typeParameters?.length ?? 0
  );
  const typeStableId = toStableId(assemblyName, declaringClrType);
  const typeParameterScope =
    declaration.typeParameters?.map((typeParameter) => typeParameter.name) ??
    [];

  const methods: FirstPartyBindingsMethod[] = [];
  const properties: FirstPartyBindingsProperty[] = [];

  for (const member of declaration.members) {
    if (member.kind === "methodSignature") {
      methods.push(
        makeMethodBinding({
          declaringClrType,
          declaringAssemblyName: assemblyName,
          methodName: member.name,
          parameters: member.parameters,
          returnType: member.returnType,
          arity: member.typeParameters?.length ?? 0,
          parameterModifiers: buildParameterModifiers(member.parameters),
          isStatic: false,
          isAbstract: true,
          localTypeNameRemaps,
        })
      );
      continue;
    }

    properties.push({
      stableId: `${typeStableId}::property:${member.name}`,
      clrName: member.name,
      normalizedSignature: `${member.name}|:${toSignatureType(
        member.type,
        typeParameterScope,
        localTypeNameRemaps
      )}|static=false|accessor=${member.isReadonly ? "get" : "getset"}`,
      isStatic: false,
      isAbstract: true,
      isVirtual: false,
      isOverride: false,
      isIndexer: false,
      hasGetter: true,
      hasSetter: !member.isReadonly,
      declaringClrType,
      declaringAssemblyName: assemblyName,
    });
  }

  return {
    stableId: typeStableId,
    clrName: declaringClrType,
    alias: toBindingTypeAlias(
      namespace,
      declaration.name,
      declaration.typeParameters?.length ?? 0
    ),
    assemblyName,
    kind: declaration.isStruct ? "Struct" : "Interface",
    accessibility: "Public",
    isAbstract: false,
    isSealed: false,
    isStatic: false,
    arity: declaration.typeParameters?.length ?? 0,
    typeParameters:
      declaration.typeParameters?.map((typeParameter) => typeParameter.name) ??
      [],
    methods,
    properties,
    fields: [],
    events: [],
    constructors: [],
  };
};

const buildTypeBindingFromEnum = (
  declaration: IrEnumDeclaration,
  namespace: string,
  assemblyName: string
): FirstPartyBindingsType => {
  const declaringClrType = toClrTypeName(namespace, declaration.name);
  const typeStableId = toStableId(assemblyName, declaringClrType);
  const fields: FirstPartyBindingsField[] = declaration.members.map(
    (member) => ({
      stableId: `${typeStableId}::field:${member.name}`,
      clrName: member.name,
      normalizedSignature: `${member.name}|${declaringClrType}|static=true|const=true`,
      isStatic: true,
      isReadOnly: true,
      isLiteral: true,
      declaringClrType,
      declaringAssemblyName: assemblyName,
    })
  );
  return {
    stableId: typeStableId,
    clrName: declaringClrType,
    alias: toBindingTypeAlias(namespace, declaration.name),
    assemblyName,
    kind: "Enum",
    accessibility: "Public",
    isAbstract: false,
    isSealed: true,
    isStatic: false,
    arity: 0,
    typeParameters: [],
    methods: [],
    properties: [],
    fields,
    events: [],
    constructors: [],
  };
};

const buildTypeBindingFromStructuralAlias = (
  declaration: IrTypeAliasDeclaration,
  namespace: string,
  assemblyName: string,
  localTypeNameRemaps: ReadonlyMap<string, string> = new Map()
): FirstPartyBindingsType | undefined => {
  if (declaration.type.kind !== "objectType") return undefined;

  const arity = declaration.typeParameters?.length ?? 0;
  const internalAliasName = `${declaration.name}__Alias`;
  const declaringClrType = toClrTypeName(namespace, internalAliasName, arity);
  const typeStableId = toStableId(assemblyName, declaringClrType);
  const typeParameterScope =
    declaration.typeParameters?.map((typeParameter) => typeParameter.name) ??
    [];

  const methods: FirstPartyBindingsMethod[] = [];
  const properties: FirstPartyBindingsProperty[] = [];

  for (const member of declaration.type.members) {
    if (member.kind === "methodSignature") {
      methods.push(
        makeMethodBinding({
          declaringClrType,
          declaringAssemblyName: assemblyName,
          methodName: member.name,
          parameters: member.parameters,
          returnType: member.returnType,
          arity: member.typeParameters?.length ?? 0,
          parameterModifiers: buildParameterModifiers(member.parameters),
          isStatic: false,
          isAbstract: true,
          localTypeNameRemaps,
        })
      );
      continue;
    }

    properties.push({
      stableId: `${typeStableId}::property:${member.name}`,
      clrName: member.name,
      normalizedSignature: `${member.name}|:${toSignatureType(
        member.type,
        typeParameterScope,
        localTypeNameRemaps
      )}|static=false|accessor=${member.isReadonly ? "get" : "getset"}`,
      isStatic: false,
      isAbstract: true,
      isVirtual: false,
      isOverride: false,
      isIndexer: false,
      hasGetter: true,
      hasSetter: !member.isReadonly,
      declaringClrType,
      declaringAssemblyName: assemblyName,
    });
  }

  return {
    stableId: typeStableId,
    clrName: declaringClrType,
    alias: toBindingTypeAlias(namespace, internalAliasName, arity),
    assemblyName,
    kind: declaration.isStruct ? "Struct" : "Class",
    accessibility: "Public",
    isAbstract: false,
    isSealed: false,
    isStatic: false,
    arity,
    typeParameters:
      declaration.typeParameters?.map((typeParameter) => typeParameter.name) ??
      [],
    methods,
    properties,
    fields: [],
    events: [],
    constructors: [],
  };
};

const buildTypeBindingFromContainer = (
  entry: ModuleContainerEntry,
  namespace: string,
  assemblyName: string
): FirstPartyBindingsType => {
  const declaringClrType = toClrTypeName(namespace, entry.module.className);
  const typeStableId = toStableId(assemblyName, declaringClrType);

  const methods = entry.methods.map((method) =>
    makeMethodBinding({
      declaringClrType,
      declaringAssemblyName: assemblyName,
      methodName: method.localName,
      parameters: method.declaration.parameters,
      returnType: method.declaration.returnType,
      arity: method.declaration.typeParameters?.length ?? 0,
      parameterModifiers: buildParameterModifiers(
        method.declaration.parameters
      ),
      isStatic: true,
      localTypeNameRemaps: method.localTypeNameRemaps,
    })
  );

  const properties: FirstPartyBindingsProperty[] = entry.variables.map(
    (variable) => ({
      stableId: `${typeStableId}::property:${variable.localName}`,
      clrName: variable.localName,
      normalizedSignature: `${variable.localName}|:${toSignatureType(
        variable.declarator?.type,
        [],
        variable.localTypeNameRemaps
      )}|static=true|accessor=getset`,
      isStatic: true,
      isAbstract: false,
      isVirtual: false,
      isOverride: false,
      isIndexer: false,
      hasGetter: true,
      hasSetter: true,
      declaringClrType,
      declaringAssemblyName: assemblyName,
    })
  );

  return {
    stableId: typeStableId,
    clrName: declaringClrType,
    alias: toBindingTypeAlias(namespace, entry.module.className),
    assemblyName,
    kind: "Class",
    accessibility: "Public",
    isAbstract: true,
    isSealed: false,
    isStatic: true,
    arity: 0,
    typeParameters: [],
    methods,
    properties,
    fields: [],
    events: [],
    constructors: [],
  };
};

const collectNamespacePlans = (
  modules: readonly IrModule[],
  assemblyName: string,
  rootNamespace: string,
  sourceIndexByFileKey: ReadonlyMap<string, ModuleSourceIndex>
): Result<readonly NamespacePlan[], string> => {
  const modulesByNamespace = new Map<string, IrModule[]>();
  modulesByNamespace.set(rootNamespace, []);
  const modulesByFileKey = new Map<string, IrModule>();
  for (const module of modules) {
    const syntheticAnonymousModule =
      module.filePath.startsWith("__tsonic/") &&
      module.body.some(
        (statement) =>
          statement.kind === "classDeclaration" &&
          statement.name.startsWith("__Anon_")
      );
    if (module.filePath.startsWith("__tsonic/") && !syntheticAnonymousModule) {
      continue;
    }
    const list = modulesByNamespace.get(module.namespace) ?? [];
    list.push(module);
    modulesByNamespace.set(module.namespace, list);
    modulesByFileKey.set(normalizeModuleFileKey(module.filePath), module);
  }

  const plans: NamespacePlan[] = [];

  for (const [namespace, moduleList] of Array.from(
    modulesByNamespace.entries()
  )) {
    const typeDeclarations: ExportedSymbol[] = [];
    const moduleContainers: ModuleContainerEntry[] = [];
    const crossNamespaceReexportsGrouped = new Map<string, string[]>();
    const crossNamespaceTypeDeclarations: ExportedSymbol[] = [];
    const seenCrossNamespaceTypeDeclarationKeys = new Set<string>();
    const valueExportsMap = new Map<
      string,
      {
        readonly exportName: string;
        readonly binding: FirstPartyBindingsExport;
        readonly facade:
          | {
              readonly kind: "function";
              readonly declaration: Extract<
                IrStatement,
                { kind: "functionDeclaration" }
              >;
              readonly sourceSignatures?: readonly SourceFunctionSignatureDef[];
              readonly localTypeNameRemaps: ReadonlyMap<string, string>;
            }
          | {
              readonly kind: "variable";
              readonly declarator:
                | {
                    readonly kind: "variableDeclarator";
                    readonly name: {
                      readonly kind: "identifierPattern";
                      readonly name: string;
                    };
                    readonly type?: IrType;
                  }
                | undefined;
              readonly localTypeNameRemaps: ReadonlyMap<string, string>;
              readonly sourceType?: SourceValueTypeDef;
              readonly sourceSignatures?: readonly SourceFunctionSignatureDef[];
            };
      }
    >();
    const seenTypeDeclarationKeys = new Set<string>();
    const sourceAliasLines = new Set<string>();
    const sourceAliasInternalImports = new Set<string>();
    const memberOverrides: MemberOverride[] = [];
    const internalTypeImportByAlias = new Map<string, SourceTypeImportBinding>();
    const facadeTypeImportByAlias = new Map<string, SourceTypeImportBinding>();
    const wrapperImportByAlias = new Map<string, WrapperImport>();
    const internalHelperTypeDeclarationsByKey = new Map<
      string,
      InternalHelperTypeDeclaration
    >();
    const internalHelperTypeRemapsByModuleKey = new Map<
      string,
      Map<string, string>
    >();

    const getInternalHelperTypeName = (
      moduleFileKey: string,
      localName: string
    ): string => {
      return `__Local_${sanitizeForBrand(moduleFileKey)}_${sanitizeForBrand(localName)}`;
    };

    const registerInternalHelperTypeClosure = (opts: {
      readonly declarationModule: IrModule;
      readonly sourceIndex: ModuleSourceIndex | undefined;
      readonly referencedNames: ReadonlySet<string>;
    }): Result<ReadonlyMap<string, string>, string> => {
      if (!opts.sourceIndex) return { ok: true, value: new Map() };

      const moduleFileKey = normalizeModuleFileKey(opts.declarationModule.filePath);
      const remaps =
        internalHelperTypeRemapsByModuleKey.get(moduleFileKey) ?? new Map();
      if (!internalHelperTypeRemapsByModuleKey.has(moduleFileKey)) {
        internalHelperTypeRemapsByModuleKey.set(moduleFileKey, remaps);
      }
      const visiting = new Set<string>();

      const visitLocalType = (localName: string): Result<void, string> => {
        if (opts.sourceIndex?.exportedTypeDeclarationNames.has(localName)) {
          return { ok: true, value: undefined };
        }
        const declaration = resolveModuleLocalDeclaration(
          opts.declarationModule,
          localName
        );
        if (!declaration) return { ok: true, value: undefined };
        const kind = classifyLocalTypeDeclarationKind(declaration);
        if (!kind) return { ok: true, value: undefined };
        const localTypeDeclaration = declaration as
          | IrClassDeclaration
          | IrInterfaceDeclaration
          | IrEnumDeclaration
          | IrTypeAliasDeclaration;

        const key = `${moduleFileKey}::${localName}`;
        if (!remaps.has(localName)) {
          remaps.set(localName, getInternalHelperTypeName(moduleFileKey, localName));
        }
        if (internalHelperTypeDeclarationsByKey.has(key)) {
          return { ok: true, value: undefined };
        }
        if (visiting.has(key)) return { ok: true, value: undefined };

        visiting.add(key);
        const nestedReferencedNames = new Set<string>();
        collectReferencedPortableTypeNamesFromDeclaration(
          localTypeDeclaration,
          nestedReferencedNames
        );
        for (const nestedName of nestedReferencedNames) {
          const visited = visitLocalType(nestedName);
          if (!visited.ok) return visited;
        }
        visiting.delete(key);

        internalHelperTypeDeclarationsByKey.set(key, {
          key,
          moduleFileKey,
          declaringNamespace: opts.declarationModule.namespace,
          emittedName: remaps.get(localName)!,
          originalName: localName,
          kind,
          declaration: localTypeDeclaration,
        });
        return { ok: true, value: undefined };
      };

      for (const referencedName of opts.referencedNames) {
        const visited = visitLocalType(referencedName);
        if (!visited.ok) return visited;
      }

      return { ok: true, value: new Map(remaps) };
    };

    const registerValueExport = (valueExport: {
      readonly exportName: string;
      readonly binding: FirstPartyBindingsExport;
      readonly facade:
        | {
            readonly kind: "function";
            readonly declaration: Extract<
              IrStatement,
              { kind: "functionDeclaration" }
            >;
            readonly sourceSignatures?: readonly SourceFunctionSignatureDef[];
            readonly localTypeNameRemaps: ReadonlyMap<string, string>;
          }
        | {
            readonly kind: "variable";
            readonly declarator:
              | {
                  readonly kind: "variableDeclarator";
                  readonly name: {
                    readonly kind: "identifierPattern";
                    readonly name: string;
                  };
                  readonly type?: IrType;
                }
            | undefined;
            readonly localTypeNameRemaps: ReadonlyMap<string, string>;
            readonly sourceType?: SourceValueTypeDef;
            readonly sourceSignatures?: readonly SourceFunctionSignatureDef[];
          };
    }): Result<void, string> => {
      const existing = valueExportsMap.get(valueExport.exportName);
      if (!existing) {
        valueExportsMap.set(valueExport.exportName, valueExport);
        return { ok: true, value: undefined };
      }
      const sameBinding =
        existing.binding.kind === valueExport.binding.kind &&
        existing.binding.clrName === valueExport.binding.clrName &&
        existing.binding.declaringClrType ===
          valueExport.binding.declaringClrType &&
        existing.binding.declaringAssemblyName ===
          valueExport.binding.declaringAssemblyName;
      const normalizeFunctionFacade = (facade: {
        readonly declaration: Extract<
          IrStatement,
          { kind: "functionDeclaration" }
        >;
        readonly sourceSignatures?: readonly SourceFunctionSignatureDef[];
        readonly localTypeNameRemaps: ReadonlyMap<string, string>;
      }): string => {
        const declaration = facade.declaration;
        const typeParametersText = printTypeParameters(
          declaration.typeParameters
        );
        const typeParameterNames =
          declaration.typeParameters?.map(
            (typeParameter) => typeParameter.name
          ) ?? [];
        const parametersText = renderUnknownParameters(
          declaration.parameters,
          typeParameterNames,
          facade.localTypeNameRemaps
        );
        const returnTypeText = renderPortableType(
          declaration.returnType,
          typeParameterNames,
          facade.localTypeNameRemaps
        );
        const sourceSignatures = (facade.sourceSignatures ?? [])
          .map(
            (signature) =>
              `${signature.typeParametersText}(${signature.parameters
                .map((parameter) => `${parameter.prefixText}${parameter.typeText}`)
                .join(", ")}):${signature.returnTypeText}`
          )
          .sort((left, right) => left.localeCompare(right))
          .join("||");
        return `${typeParametersText}(${parametersText}):${returnTypeText}|source=${sourceSignatures}`;
      };
      const normalizeVariableFacade = (
        declarator:
          | {
              readonly kind: "variableDeclarator";
              readonly name: {
                readonly kind: "identifierPattern";
                readonly name: string;
              };
              readonly type?: IrType;
            }
          | undefined,
        localTypeNameRemaps: ReadonlyMap<string, string>
      ): string => renderPortableType(
        declarator?.type,
        [],
        localTypeNameRemaps
      );
      const sameFacade = (() => {
        if (existing.facade.kind !== valueExport.facade.kind) return false;
        if (
          existing.facade.kind === "function" &&
          valueExport.facade.kind === "function"
        ) {
          return (
            normalizeFunctionFacade(existing.facade) ===
            normalizeFunctionFacade(valueExport.facade)
          );
        }
        if (
          existing.facade.kind === "variable" &&
          valueExport.facade.kind === "variable"
        ) {
          return (
            normalizeVariableFacade(
              existing.facade.declarator,
              existing.facade.localTypeNameRemaps
            ) ===
            normalizeVariableFacade(
              valueExport.facade.declarator,
              valueExport.facade.localTypeNameRemaps
            )
          );
        }
        return false;
      })();
      if (sameBinding && sameFacade) {
        return { ok: true, value: undefined };
      }
      return {
        ok: false,
        error:
          `Conflicting value export '${valueExport.exportName}' in namespace ${namespace}.\n` +
          "First-party bindings generation requires each exported value name to map deterministically to exactly one CLR member.",
      };
    };

    const registerWrapperImports = (
      wrappers: readonly WrapperImport[],
      moduleFilePath: string
    ): Result<void, string> => {
      for (const wrapper of wrappers) {
        const existing = wrapperImportByAlias.get(wrapper.aliasName);
        if (existing) {
          if (
            existing.source !== wrapper.source ||
            existing.importedName !== wrapper.importedName
          ) {
            return {
              ok: false,
              error:
                `Conflicting wrapper import alias '${wrapper.aliasName}' while generating ${moduleFilePath}.\n` +
                `- ${existing.importedName} from '${existing.source}'\n` +
                `- ${wrapper.importedName} from '${wrapper.source}'\n` +
                "Disambiguate ExtensionMethods aliases in source code.",
            };
          }
          continue;
        }
        wrapperImportByAlias.set(wrapper.aliasName, wrapper);
      }
      return { ok: true, value: undefined };
    };

    const registerCrossNamespaceReexport = (opts: {
      readonly declaringNamespace: string;
      readonly exportName: string;
      readonly localName: string;
      readonly kind: "type" | "value";
    }): void => {
      if (opts.declaringNamespace === namespace) return;
      const moduleSpecifier = `./${moduleNamespacePath(opts.declaringNamespace)}.js`;
      const key = `${moduleSpecifier}|${opts.kind}`;
      const specifier =
        opts.exportName === opts.localName
          ? opts.exportName
          : `${opts.localName} as ${opts.exportName}`;
      const existing = crossNamespaceReexportsGrouped.get(key) ?? [];
      existing.push(specifier);
      crossNamespaceReexportsGrouped.set(key, existing);
    };

    const registerCrossNamespaceTypeDeclaration = (
      symbol: ExportedSymbol
    ): void => {
      if (symbol.declaringNamespace === namespace) return;
      const key = `${symbol.declaringNamespace}|${symbol.declaringClassName}|${symbol.localName}|${symbol.kind}`;
      if (seenCrossNamespaceTypeDeclarationKeys.has(key)) return;
      seenCrossNamespaceTypeDeclarationKeys.add(key);
      crossNamespaceTypeDeclarations.push(symbol);
    };

    const registerSourceTypeImportCandidates = (
      sourceIndex: ModuleSourceIndex,
      moduleKey: string,
      moduleFilePath: string
    ): Result<void, string> => {
      for (const [localName, imported] of sourceIndex.typeImportsByLocalName) {
        if (sourceIndex.wrapperImportsByLocalName.has(localName)) continue;

        const internalImport = resolveSourceTypeImportBinding({
          context: "internal",
          currentNamespace: namespace,
          currentModuleKey: moduleKey,
          localName,
          imported,
          modulesByFileKey,
        });
        if (!internalImport.ok) return internalImport;
        if (internalImport.value) {
          const registered = registerSourceTypeImportBinding(
            internalTypeImportByAlias,
            internalImport.value,
            namespace,
            moduleFilePath
          );
          if (!registered.ok) return registered;
        }

        const facadeImport = resolveSourceTypeImportBinding({
          context: "facade",
          currentNamespace: namespace,
          currentModuleKey: moduleKey,
          localName,
          imported,
          modulesByFileKey,
        });
        if (!facadeImport.ok) return facadeImport;
        if (facadeImport.value) {
          const registered = registerSourceTypeImportBinding(
            facadeTypeImportByAlias,
            facadeImport.value,
            namespace,
            moduleFilePath
          );
          if (!registered.ok) return registered;
        }
      }

      return { ok: true, value: undefined };
    };

    const registerFacadeLocalTypeReferenceImports = (opts: {
      readonly declarationModule: IrModule;
      readonly declarationNamespace: string;
      readonly declarationFilePath: string;
      readonly sourceIndex: ModuleSourceIndex | undefined;
      readonly typeParameters: readonly IrTypeParameter[] | undefined;
      readonly parameterTypes: readonly (IrType | undefined)[];
      readonly returnType: IrType | undefined;
    }): Result<ReadonlyMap<string, string>, string> => {
      const typeParameterNames = new Set(
        (opts.typeParameters ?? []).map((typeParameter) => typeParameter.name)
      );
      const referencedNames = new Set<string>();
      for (const parameterType of opts.parameterTypes) {
        collectReferencedPortableTypeNames(
          parameterType,
          typeParameterNames,
          referencedNames
        );
      }
      collectReferencedPortableTypeNames(
        opts.returnType,
        typeParameterNames,
        referencedNames
      );

      const helperTypeRemaps = registerInternalHelperTypeClosure({
        declarationModule: opts.declarationModule,
        sourceIndex: opts.sourceIndex,
        referencedNames,
      });
      if (!helperTypeRemaps.ok) return helperTypeRemaps;
      if (!opts.sourceIndex) return helperTypeRemaps;

      if (opts.declarationNamespace === namespace) {
        return helperTypeRemaps;
      }

      const moduleSpecifier = `./${moduleNamespacePath(opts.declarationNamespace)}.js`;
      for (const referencedName of referencedNames) {
        if (!opts.sourceIndex.exportedTypeDeclarationNames.has(referencedName)) {
          continue;
        }
        const registered = registerSourceTypeImportBinding(
          facadeTypeImportByAlias,
          {
            importedName: referencedName,
            localName: referencedName,
            source: moduleSpecifier,
          },
          namespace,
          opts.declarationFilePath
        );
        if (!registered.ok) return registered;
      }

      return helperTypeRemaps;
    };

    for (const module of moduleList.sort((left, right) =>
      left.filePath.localeCompare(right.filePath)
    )) {
      const moduleKey = normalizeModuleFileKey(module.filePath);
      const sourceIndex = sourceIndexByFileKey.get(moduleKey);

      if (sourceIndex) {
        const registered = registerSourceTypeImportCandidates(
          sourceIndex,
          moduleKey,
          module.filePath
        );
        if (!registered.ok) return registered;

        const exportedAliasDecls = module.body.filter(
          (
            stmt
          ): stmt is Extract<IrStatement, { kind: "typeAliasDeclaration" }> =>
            stmt.kind === "typeAliasDeclaration" && stmt.isExported
        );

        for (const alias of exportedAliasDecls) {
          const sourceAlias = sourceIndex.typeAliasesByName.get(alias.name);
          const sourceTypeParams =
            sourceAlias?.typeParametersText ??
            printTypeParameters(alias.typeParameters);
          if (alias.type.kind === "objectType") {
            const arity = alias.typeParameters?.length ?? 0;
            const internalName = `${alias.name}__Alias${arity > 0 ? `_${arity}` : ""}`;
            const typeArgs =
              sourceAlias && sourceAlias.typeParameterNames.length > 0
                ? `<${sourceAlias.typeParameterNames.join(", ")}>`
                : alias.typeParameters && alias.typeParameters.length > 0
                  ? `<${alias.typeParameters.map((tp) => tp.name).join(", ")}>`
                  : "";
            sourceAliasLines.add(
              `export type ${alias.name}${sourceTypeParams} = ${internalName}${typeArgs};`
            );
            sourceAliasInternalImports.add(internalName);
            continue;
          }

          const rhs = renderPortableType(
            alias.type,
            alias.typeParameters?.map((tp) => tp.name) ?? []
          );
          const shouldPreferSourceAliasText =
            sourceAlias !== undefined &&
            !typeNodeUsesImportedTypeNames(
              sourceAlias.type,
              sourceIndex.typeImportsByLocalName
            ) &&
            /__\d+\b|\$instance\b/.test(rhs);
          sourceAliasLines.add(
            `export type ${alias.name}${sourceTypeParams} = ${
              shouldPreferSourceAliasText ? sourceAlias.typeText : rhs
            };`
          );
        }

        const exportedClasses = module.body.filter(
          (stmt): stmt is Extract<IrStatement, { kind: "classDeclaration" }> =>
            stmt.kind === "classDeclaration" && stmt.isExported
        );
        const exportedInterfaces = module.body.filter(
          (
            stmt
          ): stmt is Extract<IrStatement, { kind: "interfaceDeclaration" }> =>
            stmt.kind === "interfaceDeclaration" && stmt.isExported
        );
        const exportedAliases = module.body.filter(
          (
            stmt
          ): stmt is Extract<IrStatement, { kind: "typeAliasDeclaration" }> =>
            stmt.kind === "typeAliasDeclaration" && stmt.isExported
        );

        for (const cls of exportedClasses) {
          const sourceMembers = sourceIndex.memberTypesByClassAndMember.get(
            cls.name
          );
          if (!sourceMembers) continue;
          for (const member of cls.members) {
            if (member.kind !== "propertyDeclaration") continue;
            if (member.isStatic || member.accessibility === "private") continue;
            const sourceMember = sourceMembers.get(member.name);
            if (!sourceMember) continue;
            const wrappersResult = collectExtensionWrapperImportsFromSourceType(
              {
                startModuleKey: moduleKey,
                typeNode: sourceMember.typeNode,
                sourceIndexByFileKey,
                modulesByFileKey,
              }
            );
            if (!wrappersResult.ok) return wrappersResult;
            const wrappers = wrappersResult.value;
            const canUseSourceTypeText = !typeNodeUsesImportedTypeNames(
              sourceMember.typeNode,
              sourceIndex.typeImportsByLocalName
            );
            if (
              !canUseSourceTypeText &&
              wrappers.length === 0 &&
              !sourceMember.isOptional
            ) {
              continue;
            }
            const wrapperRegistered = registerWrapperImports(
              wrappers,
              module.filePath
            );
            if (!wrapperRegistered.ok) return wrapperRegistered;
            memberOverrides.push({
              className: cls.name,
              memberName: member.name,
              sourceTypeText: canUseSourceTypeText
                ? sourceMember.typeText
                : undefined,
              replaceWithSourceType: canUseSourceTypeText,
              isOptional: sourceMember.isOptional,
              wrappers,
            });
          }
        }

        for (const iface of exportedInterfaces) {
          const sourceMembers = sourceIndex.memberTypesByClassAndMember.get(
            iface.name
          );
          if (!sourceMembers) continue;
          for (const member of iface.members) {
            if (member.kind !== "propertySignature") continue;
            const sourceMember = sourceMembers.get(member.name);
            if (!sourceMember) continue;
            const wrappersResult = collectExtensionWrapperImportsFromSourceType(
              {
                startModuleKey: moduleKey,
                typeNode: sourceMember.typeNode,
                sourceIndexByFileKey,
                modulesByFileKey,
              }
            );
            if (!wrappersResult.ok) return wrappersResult;
            const wrappers = wrappersResult.value;
            const canUseSourceTypeText = !typeNodeUsesImportedTypeNames(
              sourceMember.typeNode,
              sourceIndex.typeImportsByLocalName
            );
            if (!canUseSourceTypeText && wrappers.length === 0) continue;
            const wrapperRegistered = registerWrapperImports(
              wrappers,
              module.filePath
            );
            if (!wrapperRegistered.ok) return wrapperRegistered;
            memberOverrides.push({
              className: iface.name,
              memberName: member.name,
              sourceTypeText: canUseSourceTypeText
                ? sourceMember.typeText
                : undefined,
              replaceWithSourceType: canUseSourceTypeText,
              isOptional: sourceMember.isOptional,
              emitOptionalPropertySyntax: true,
              wrappers,
            });
          }
        }

        for (const alias of exportedAliases) {
          const sourceAlias = sourceIndex.typeAliasesByName.get(alias.name);
          if (!sourceAlias) continue;
          const aliasType = unwrapParens(sourceAlias.type);
          if (!ts.isTypeLiteralNode(aliasType)) continue;
          const arity = sourceAlias.typeParameterNames.length;
          const internalAliasName = `${alias.name}__Alias${arity > 0 ? `_${arity}` : ""}`;
          for (const member of aliasType.members) {
            if (!ts.isPropertySignature(member)) continue;
            if (!member.name || !member.type) continue;
            const memberName = getPropertyNameText(member.name);
            if (!memberName) continue;
            const wrappersResult = collectExtensionWrapperImportsFromSourceType(
              {
                startModuleKey: moduleKey,
                typeNode: member.type,
                sourceIndexByFileKey,
                modulesByFileKey,
              }
            );
            if (!wrappersResult.ok) return wrappersResult;
            const wrappers = wrappersResult.value;
            const canUseSourceTypeText = !typeNodeUsesImportedTypeNames(
              member.type,
              sourceIndex.typeImportsByLocalName
            );
            if (!canUseSourceTypeText && wrappers.length === 0) continue;
            const wrapperRegistered = registerWrapperImports(
              wrappers,
              module.filePath
            );
            if (!wrapperRegistered.ok) return wrapperRegistered;
            memberOverrides.push({
              className: internalAliasName,
              memberName,
              sourceTypeText: canUseSourceTypeText
                ? printTypeNodeText(member.type, member.getSourceFile())
                : undefined,
              replaceWithSourceType: canUseSourceTypeText,
              isOptional: member.questionToken !== undefined,
              wrappers,
            });
          }
        }
      }

      for (const exportItem of module.exports) {
        if (exportItem.kind !== "reexport") continue;
        const resolved = resolveExportedDeclaration(
          module,
          exportItem.name,
          modulesByFileKey
        );
        if (!resolved.ok) return resolved;
        const declaration = resolved.value.declaration;
        const declarationModule = resolved.value.module;
        const exportKind = classifyDeclarationKind(
          declaration,
          declarationModule.filePath,
          exportItem.name
        );
        if (!exportKind.ok) return exportKind;
        if (declarationModule.namespace !== namespace) {
          registerCrossNamespaceReexport({
            declaringNamespace: declarationModule.namespace,
            exportName: exportItem.name,
            localName: resolved.value.clrName,
            kind:
              exportKind.value === "interface" || exportKind.value === "typeAlias"
                ? "type"
                : "value",
          });
        }
        if (exportKind.value === "function") {
          const functionDeclaration =
            declaration.kind === "functionDeclaration"
              ? declaration
              : undefined;
          if (!functionDeclaration) {
            return {
              ok: false,
              error: `Invalid function export '${exportItem.name}' in ${declarationModule.filePath}: expected function declaration.`,
            };
          }
          const declarationModuleKey = normalizeModuleFileKey(
            declarationModule.filePath
          );
          const declarationSourceIndex =
            sourceIndexByFileKey.get(declarationModuleKey);
          if (declarationSourceIndex) {
            const registered = registerSourceTypeImportCandidates(
              declarationSourceIndex,
              declarationModuleKey,
              declarationModule.filePath
            );
            if (!registered.ok) return registered;
          }
          const registeredLocalTypeRefs =
            registerFacadeLocalTypeReferenceImports({
              declarationModule,
              declarationNamespace: declarationModule.namespace,
              declarationFilePath: declarationModule.filePath,
              sourceIndex: declarationSourceIndex,
              typeParameters: functionDeclaration.typeParameters,
              parameterTypes: functionDeclaration.parameters.map(
                (parameter) => parameter.type
              ),
              returnType: functionDeclaration.returnType,
            });
          if (!registeredLocalTypeRefs.ok) return registeredLocalTypeRefs;
          const registered = registerValueExport({
            exportName: exportItem.name,
            binding: {
              kind: "method",
              clrName: resolved.value.clrName,
              declaringClrType: toClrTypeName(
                declarationModule.namespace,
                declarationModule.className
              ),
              declaringAssemblyName: assemblyName,
            },
            facade: {
              kind: "function",
              declaration: functionDeclaration,
              localTypeNameRemaps: registeredLocalTypeRefs.value,
              sourceSignatures:
                sourceIndexByFileKey
                  .get(normalizeModuleFileKey(declarationModule.filePath))
                  ?.exportedFunctionSignaturesByName.get(
                    resolved.value.clrName
                  ) ?? [],
            },
          });
          if (!registered.ok) return registered;
          continue;
        }
        if (exportKind.value === "variable") {
          const declarationStatement =
            declaration.kind === "variableDeclaration"
              ? declaration
              : undefined;
          if (!declarationStatement) {
            return {
              ok: false,
              error: `Invalid variable export '${exportItem.name}' in ${declarationModule.filePath}: expected variable declaration.`,
            };
          }
          const declarationModuleKey = normalizeModuleFileKey(
            declarationModule.filePath
          );
          const declarationSourceIndex =
            sourceIndexByFileKey.get(declarationModuleKey);
          if (declarationSourceIndex) {
            const registered = registerSourceTypeImportCandidates(
              declarationSourceIndex,
              declarationModuleKey,
              declarationModule.filePath
            );
            if (!registered.ok) return registered;
          }
          const declarator = declarationStatement.declarations.find(
            (candidate) =>
              candidate.name.kind === "identifierPattern" &&
              candidate.name.name === resolved.value.clrName
          );
          const registeredLocalTypeRefs =
            registerFacadeLocalTypeReferenceImports({
              declarationModule,
              declarationNamespace: declarationModule.namespace,
              declarationFilePath: declarationModule.filePath,
              sourceIndex: declarationSourceIndex,
              typeParameters: undefined,
              parameterTypes: declarator?.type ? [declarator.type] : [],
              returnType: undefined,
            });
          if (!registeredLocalTypeRefs.ok) return registeredLocalTypeRefs;
          const registered = registerValueExport({
            exportName: exportItem.name,
            binding: {
              kind: "field",
              clrName: resolved.value.clrName,
              declaringClrType: toClrTypeName(
                declarationModule.namespace,
                declarationModule.className
              ),
              declaringAssemblyName: assemblyName,
            },
            facade: {
              kind: "variable",
              localTypeNameRemaps: registeredLocalTypeRefs.value,
              sourceType:
                declarationSourceIndex?.exportedValueTypesByName.get(
                  resolved.value.clrName
                ),
              sourceSignatures:
                declarationSourceIndex?.exportedFunctionSignaturesByName.get(
                  resolved.value.clrName
                ) ?? [],
              declarator:
                declarator && declarator.name.kind === "identifierPattern"
                  ? {
                      kind: declarator.kind,
                      name: declarator.name,
                      type: declarator.type,
                    }
                  : undefined,
            },
          });
          if (!registered.ok) return registered;
          continue;
        }

        if (
          exportKind.value === "class" ||
          exportKind.value === "interface" ||
          exportKind.value === "enum" ||
          exportKind.value === "typeAlias"
        ) {
          if (declarationModule.namespace !== namespace) {
            registerCrossNamespaceTypeDeclaration({
              exportName: exportItem.name,
              localName: resolved.value.clrName,
              kind: exportKind.value,
              declaration,
              declaringNamespace: declarationModule.namespace,
              declaringClassName: declarationModule.className,
              declaringFilePath: declarationModule.filePath,
            });
            continue;
          }
          const declarationModuleKey = normalizeModuleFileKey(
            declarationModule.filePath
          );
          const declarationSourceIndex =
            sourceIndexByFileKey.get(declarationModuleKey);
          if (declarationSourceIndex) {
            const registered = registerSourceTypeImportCandidates(
              declarationSourceIndex,
              declarationModuleKey,
              declarationModule.filePath
            );
            if (!registered.ok) return registered;
          }
          if (
            exportKind.value === "typeAlias" &&
            declaration.kind === "typeAliasDeclaration" &&
            declaration.type.kind !== "objectType"
          ) {
            continue;
          }
          const typeKey = `${declarationModule.namespace}|${declarationModule.className}|${resolved.value.clrName}|${exportKind.value}`;
          if (seenTypeDeclarationKeys.has(typeKey)) continue;
          seenTypeDeclarationKeys.add(typeKey);
          typeDeclarations.push({
            exportName: exportItem.name,
            localName: resolved.value.clrName,
            kind: exportKind.value,
            declaration,
            declaringNamespace: declarationModule.namespace,
            declaringClassName: declarationModule.className,
            declaringFilePath: declarationModule.filePath,
          });
        }
      }

      const moduleExports = collectModuleExports(module, modulesByFileKey);
      if (!moduleExports.ok) return moduleExports;
      const containerMethods: ModuleContainerEntry["methods"] = [];
      const containerVariables: ModuleContainerEntry["variables"] = [];

      if (module.filePath.startsWith("__tsonic/")) {
        for (const statement of module.body) {
          if (statement.kind !== "classDeclaration") continue;
          if (!statement.name.startsWith("__Anon_")) continue;
          const key = `${statement.name}|class`;
          if (seenTypeDeclarationKeys.has(key)) continue;
          seenTypeDeclarationKeys.add(key);
          typeDeclarations.push({
            exportName: statement.name,
            localName: statement.name,
            kind: "class",
            declaration: statement,
            declaringNamespace: module.namespace,
            declaringClassName: module.className,
            declaringFilePath: module.filePath,
          });
        }
      }

      for (const symbol of moduleExports.value) {
        if (
          symbol.kind === "class" ||
          symbol.kind === "interface" ||
          symbol.kind === "enum" ||
          symbol.kind === "typeAlias"
        ) {
          if (symbol.declaringNamespace !== namespace) {
            registerCrossNamespaceReexport({
              declaringNamespace: symbol.declaringNamespace,
              exportName: symbol.exportName,
              localName: symbol.localName,
              kind:
                symbol.kind === "interface" || symbol.kind === "typeAlias"
                  ? "type"
                  : "value",
            });
            registerCrossNamespaceTypeDeclaration(symbol);
            continue;
          }
          if (
            symbol.kind === "typeAlias" &&
            symbol.declaration.kind === "typeAliasDeclaration" &&
            symbol.declaration.type.kind !== "objectType"
          ) {
            continue;
          }
          const key = `${symbol.declaringNamespace}|${symbol.declaringClassName}|${symbol.localName}|${symbol.kind}`;
          if (!seenTypeDeclarationKeys.has(key)) {
            seenTypeDeclarationKeys.add(key);
            typeDeclarations.push(symbol);
          }
        }

        if (symbol.kind === "function") {
          if (symbol.declaringNamespace !== namespace) {
            registerCrossNamespaceReexport({
              declaringNamespace: symbol.declaringNamespace,
              exportName: symbol.exportName,
              localName: symbol.localName,
              kind: "value",
            });
          }
          const functionDeclaration =
            symbol.declaration.kind === "functionDeclaration"
              ? symbol.declaration
              : undefined;
          if (!functionDeclaration) continue;
          const symbolModuleKey = normalizeModuleFileKey(symbol.declaringFilePath);
          const symbolSourceIndex = sourceIndexByFileKey.get(symbolModuleKey);
          const symbolDeclarationModule = modulesByFileKey.get(symbolModuleKey);
          if (!symbolDeclarationModule) {
            return {
              ok: false,
              error:
                `Unable to resolve declaring module for '${symbol.exportName}' while generating ${symbol.declaringFilePath}.\n` +
                "First-party bindings generation requires a stable source module for each exported value.",
            };
          }
          if (symbolSourceIndex) {
            const registered = registerSourceTypeImportCandidates(
              symbolSourceIndex,
              symbolModuleKey,
              symbol.declaringFilePath
            );
            if (!registered.ok) return registered;
          }
          const registeredLocalTypeRefs =
            registerFacadeLocalTypeReferenceImports({
              declarationModule: symbolDeclarationModule,
              declarationNamespace: symbol.declaringNamespace,
              declarationFilePath: symbol.declaringFilePath,
              sourceIndex: symbolSourceIndex,
              typeParameters: functionDeclaration.typeParameters,
              parameterTypes: functionDeclaration.parameters.map(
                (parameter) => parameter.type
              ),
              returnType: functionDeclaration.returnType,
            });
          if (!registeredLocalTypeRefs.ok) return registeredLocalTypeRefs;
          const isLocalContainerMember =
            symbol.declaringNamespace === module.namespace &&
            symbol.declaringClassName === module.className;
          if (isLocalContainerMember) {
            containerMethods.push({
              exportName: symbol.exportName,
              localName: symbol.localName,
              declaration: functionDeclaration,
              localTypeNameRemaps: registeredLocalTypeRefs.value,
              sourceSignatures:
                sourceIndexByFileKey
                  .get(normalizeModuleFileKey(symbol.declaringFilePath))
                  ?.exportedFunctionSignaturesByName.get(symbol.localName) ??
                [],
            });
          }
          const registered = registerValueExport({
            exportName: symbol.exportName,
            binding: {
              kind: "method",
              clrName: symbol.localName,
              declaringClrType: toClrTypeName(
                symbol.declaringNamespace,
                symbol.declaringClassName
              ),
              declaringAssemblyName: assemblyName,
            },
            facade: {
              kind: "function",
              declaration: functionDeclaration,
              localTypeNameRemaps: registeredLocalTypeRefs.value,
              sourceSignatures:
                sourceIndexByFileKey
                  .get(normalizeModuleFileKey(symbol.declaringFilePath))
                  ?.exportedFunctionSignaturesByName.get(symbol.localName) ??
                [],
            },
          });
          if (!registered.ok) return registered;
          continue;
        }

        if (symbol.kind === "variable") {
          if (symbol.declaringNamespace !== namespace) {
            registerCrossNamespaceReexport({
              declaringNamespace: symbol.declaringNamespace,
              exportName: symbol.exportName,
              localName: symbol.localName,
              kind: "value",
            });
          }
          const declaration =
            symbol.declaration.kind === "variableDeclaration"
              ? symbol.declaration
              : undefined;
          if (!declaration) continue;
          const symbolModuleKey = normalizeModuleFileKey(symbol.declaringFilePath);
          const symbolSourceIndex = sourceIndexByFileKey.get(symbolModuleKey);
          const symbolDeclarationModule = modulesByFileKey.get(symbolModuleKey);
          if (!symbolDeclarationModule) {
            return {
              ok: false,
              error:
                `Unable to resolve declaring module for '${symbol.exportName}' while generating ${symbol.declaringFilePath}.\n` +
                "First-party bindings generation requires a stable source module for each exported value.",
            };
          }
          if (symbolSourceIndex) {
            const registered = registerSourceTypeImportCandidates(
              symbolSourceIndex,
              symbolModuleKey,
              symbol.declaringFilePath
            );
            if (!registered.ok) return registered;
          }
          const declarator = declaration.declarations.find(
            (candidate) =>
              candidate.name.kind === "identifierPattern" &&
              candidate.name.name === symbol.localName
          );
          const registeredLocalTypeRefs =
            registerFacadeLocalTypeReferenceImports({
              declarationModule: symbolDeclarationModule,
              declarationNamespace: symbol.declaringNamespace,
              declarationFilePath: symbol.declaringFilePath,
              sourceIndex: symbolSourceIndex,
              typeParameters: undefined,
              parameterTypes: declarator?.type ? [declarator.type] : [],
              returnType: undefined,
            });
          if (!registeredLocalTypeRefs.ok) return registeredLocalTypeRefs;
          const isLocalContainerMember =
            symbol.declaringNamespace === module.namespace &&
            symbol.declaringClassName === module.className;
          if (isLocalContainerMember) {
            containerVariables.push({
              exportName: symbol.exportName,
              localName: symbol.localName,
              declaration,
              declarator:
                declarator && declarator.name.kind === "identifierPattern"
                  ? {
                      kind: declarator.kind,
                      name: declarator.name,
                      type: declarator.type,
                    }
                  : undefined,
              localTypeNameRemaps: registeredLocalTypeRefs.value,
              sourceType:
                sourceIndexByFileKey
                  .get(normalizeModuleFileKey(symbol.declaringFilePath))
                  ?.exportedValueTypesByName.get(symbol.localName),
              sourceSignatures:
                sourceIndexByFileKey
                  .get(normalizeModuleFileKey(symbol.declaringFilePath))
                  ?.exportedFunctionSignaturesByName.get(symbol.localName) ??
                [],
            });
          }
          const registered = registerValueExport({
            exportName: symbol.exportName,
            binding: {
              kind: "field",
              clrName: symbol.localName,
              declaringClrType: toClrTypeName(
                symbol.declaringNamespace,
                symbol.declaringClassName
              ),
              declaringAssemblyName: assemblyName,
            },
            facade: {
              kind: "variable",
              localTypeNameRemaps: registeredLocalTypeRefs.value,
              sourceType:
                symbolSourceIndex?.exportedValueTypesByName.get(symbol.localName),
              sourceSignatures:
                symbolSourceIndex?.exportedFunctionSignaturesByName.get(
                  symbol.localName
                ) ?? [],
              declarator:
                declarator && declarator.name.kind === "identifierPattern"
                  ? {
                      kind: declarator.kind,
                      name: declarator.name,
                      type: declarator.type,
                    }
                  : undefined,
            },
          });
          if (!registered.ok) return registered;
        }
      }

      if (containerMethods.length > 0 || containerVariables.length > 0) {
        moduleContainers.push({
          module,
          methods: containerMethods,
          variables: containerVariables,
        });
      }
    }

    plans.push({
      namespace,
      typeDeclarations: typeDeclarations.sort((left, right) =>
        left.exportName.localeCompare(right.exportName)
      ),
      internalHelperTypeDeclarations: Array.from(
        internalHelperTypeDeclarationsByKey.values()
      ).sort((left, right) => left.key.localeCompare(right.key)),
      moduleContainers: moduleContainers.sort((left, right) =>
        left.module.className.localeCompare(right.module.className)
      ),
      crossNamespaceReexports: finalizeCrossNamespaceReexports(
        crossNamespaceReexportsGrouped
      ),
      crossNamespaceTypeDeclarations: crossNamespaceTypeDeclarations.sort(
        (left, right) => {
          const leftKey = `${left.exportName}|${left.declaringNamespace}|${left.localName}|${left.kind}`;
          const rightKey = `${right.exportName}|${right.declaringNamespace}|${right.localName}|${right.kind}`;
          return leftKey.localeCompare(rightKey);
        }
      ),
      sourceAliasLines: Array.from(sourceAliasLines.values()).sort(
        (left, right) => left.localeCompare(right)
      ),
      sourceAliasInternalImports: Array.from(
        sourceAliasInternalImports.values()
      ).sort((left, right) => left.localeCompare(right)),
      memberOverrides: memberOverrides.sort((left, right) => {
        const classCmp = left.className.localeCompare(right.className);
        if (classCmp !== 0) return classCmp;
        return left.memberName.localeCompare(right.memberName);
      }),
      internalTypeImports: Array.from(internalTypeImportByAlias.values()).sort(
        (left, right) => left.localName.localeCompare(right.localName)
      ),
      facadeTypeImports: Array.from(facadeTypeImportByAlias.values()).sort(
        (left, right) => left.localName.localeCompare(right.localName)
      ),
      wrapperImports: Array.from(wrapperImportByAlias.values()).sort(
        (left, right) => left.aliasName.localeCompare(right.aliasName)
      ),
      valueExports: Array.from(valueExportsMap.values()).sort((left, right) =>
        left.exportName.localeCompare(right.exportName)
      ),
    });
  }

  return {
    ok: true,
    value: plans.sort((left, right) =>
      left.namespace.localeCompare(right.namespace)
    ),
  };
};

const writeNamespaceArtifacts = (
  config: ResolvedConfig,
  outDir: string,
  plan: NamespacePlan
): Result<void, string> => {
  const namespacePath = moduleNamespacePath(plan.namespace);
  const namespaceDir = join(outDir, namespacePath);
  const internalDir = join(namespaceDir, "internal");
  mkdirSync(internalDir, { recursive: true });

  const internalIndexPath = join(internalDir, "index.d.ts");
  const facadeDtsPath = join(outDir, `${namespacePath}.d.ts`);
  const facadeJsPath = join(outDir, `${namespacePath}.js`);
  const bindingsPath = join(namespaceDir, "bindings.json");

  const internalBodyLines: string[] = [];
  const memberOverridesByClass = new Map<string, Map<string, MemberOverride>>();
  for (const override of plan.memberOverrides) {
    const byMember =
      memberOverridesByClass.get(override.className) ??
      new Map<string, MemberOverride>();
    byMember.set(override.memberName, override);
    memberOverridesByClass.set(override.className, byMember);
  }

  const typeBindings: FirstPartyBindingsType[] = [];

  for (const symbol of plan.typeDeclarations) {
    if (
      symbol.kind === "class" &&
      symbol.declaration.kind === "classDeclaration"
    ) {
      internalBodyLines.push(
        ...renderClassInternal(
          symbol.declaration,
          plan.namespace,
          memberOverridesByClass.get(symbol.declaration.name) ?? new Map()
        )
      );
      typeBindings.push(
        buildTypeBindingFromClass(
          symbol.declaration,
          plan.namespace,
          config.outputName
        )
      );
      continue;
    }

    if (
      symbol.kind === "interface" &&
      symbol.declaration.kind === "interfaceDeclaration"
    ) {
      internalBodyLines.push(
        ...renderInterfaceInternal(
          symbol.declaration,
          plan.namespace,
          memberOverridesByClass.get(symbol.declaration.name) ?? new Map()
        )
      );
      typeBindings.push(
        buildTypeBindingFromInterface(
          symbol.declaration,
          plan.namespace,
          config.outputName
        )
      );
      continue;
    }

    if (
      symbol.kind === "enum" &&
      symbol.declaration.kind === "enumDeclaration"
    ) {
      internalBodyLines.push(...renderEnumInternal(symbol.declaration));
      typeBindings.push(
        buildTypeBindingFromEnum(
          symbol.declaration,
          plan.namespace,
          config.outputName
        )
      );
      continue;
    }

    if (
      symbol.kind === "typeAlias" &&
      symbol.declaration.kind === "typeAliasDeclaration"
    ) {
      internalBodyLines.push(
        ...renderStructuralAliasInternal(
          symbol.declaration,
          plan.namespace,
          memberOverridesByClass.get(
            `${symbol.declaration.name}__Alias${
              (symbol.declaration.typeParameters?.length ?? 0) > 0
                ? `_${symbol.declaration.typeParameters?.length ?? 0}`
                : ""
            }`
          ) ?? new Map()
        )
      );
      const binding = buildTypeBindingFromStructuralAlias(
        symbol.declaration,
        plan.namespace,
        config.outputName
      );
      if (binding) typeBindings.push(binding);
    }
  }

  const helperRemapsByModuleKey = new Map<
    string,
    ReadonlyMap<string, string>
  >();
  for (const helper of plan.internalHelperTypeDeclarations) {
    const current = new Map(helperRemapsByModuleKey.get(helper.moduleFileKey) ?? []);
    current.set(helper.originalName, helper.emittedName);
    helperRemapsByModuleKey.set(helper.moduleFileKey, current);
  }

  for (const helper of plan.internalHelperTypeDeclarations) {
    const localTypeNameRemaps =
      helperRemapsByModuleKey.get(helper.moduleFileKey) ?? new Map();
    switch (helper.kind) {
      case "class":
        internalBodyLines.push(
          ...renderClassInternal(
            helper.declaration as IrClassDeclaration,
            helper.declaringNamespace,
            new Map(),
            helper.emittedName,
            localTypeNameRemaps,
            (helper.declaration as IrClassDeclaration).name,
            (helper.declaration as IrClassDeclaration).name
          )
        );
        typeBindings.push(
          buildTypeBindingFromClass(
            helper.declaration as IrClassDeclaration,
            helper.declaringNamespace,
            config.outputName,
            localTypeNameRemaps
          )
        );
        continue;
      case "interface":
        internalBodyLines.push(
          ...renderInterfaceInternal(
            helper.declaration as IrInterfaceDeclaration,
            helper.declaringNamespace,
            new Map(),
            helper.emittedName,
            localTypeNameRemaps,
            (helper.declaration as IrInterfaceDeclaration).name,
            (helper.declaration as IrInterfaceDeclaration).name
          )
        );
        typeBindings.push(
          buildTypeBindingFromInterface(
            helper.declaration as IrInterfaceDeclaration,
            helper.declaringNamespace,
            config.outputName,
            localTypeNameRemaps
          )
        );
        continue;
      case "enum":
        internalBodyLines.push(
          ...renderEnumInternal(
            helper.declaration as IrEnumDeclaration,
            helper.emittedName
          )
        );
        typeBindings.push(
          buildTypeBindingFromEnum(
            helper.declaration as IrEnumDeclaration,
            helper.declaringNamespace,
            config.outputName
          )
        );
        continue;
      case "typeAlias": {
        const structuralLines = renderStructuralAliasInternal(
          helper.declaration as IrTypeAliasDeclaration,
          helper.declaringNamespace,
          new Map(),
          helper.emittedName,
          localTypeNameRemaps,
          `${(helper.declaration as IrTypeAliasDeclaration).name}__Alias${
            ((helper.declaration as IrTypeAliasDeclaration).typeParameters
              ?.length ?? 0) > 0
              ? `_${
                  (helper.declaration as IrTypeAliasDeclaration).typeParameters
                    ?.length ?? 0
                }`
              : ""
          }`,
          `${(helper.declaration as IrTypeAliasDeclaration).name}__Alias${
            ((helper.declaration as IrTypeAliasDeclaration).typeParameters
              ?.length ?? 0) > 0
              ? `_${
                  (helper.declaration as IrTypeAliasDeclaration).typeParameters
                    ?.length ?? 0
                }`
              : ""
          }`
        );
        if (structuralLines.length > 0) {
          internalBodyLines.push(...structuralLines);
          const binding = buildTypeBindingFromStructuralAlias(
            helper.declaration as IrTypeAliasDeclaration,
            helper.declaringNamespace,
            config.outputName,
            localTypeNameRemaps
          );
          if (binding) typeBindings.push(binding);
          continue;
        }
        internalBodyLines.push(
          ...renderTypeAliasInternal(
            helper.declaration as IrTypeAliasDeclaration,
            helper.emittedName,
            localTypeNameRemaps
          )
        );
        continue;
      }
    }
  }

  const anonymousStructuralAliases = buildAnonymousStructuralAliasMap(plan);

  for (const container of plan.moduleContainers) {
    internalBodyLines.push(
      ...renderContainerInternal(container, anonymousStructuralAliases)
    );
    typeBindings.push(
      buildTypeBindingFromContainer(
        container,
        plan.namespace,
        config.outputName
      )
    );
  }

  for (const symbol of plan.crossNamespaceTypeDeclarations) {
    if (
      symbol.kind === "class" &&
      symbol.declaration.kind === "classDeclaration"
    ) {
      typeBindings.push(
        buildTypeBindingFromClass(
          symbol.declaration,
          symbol.declaringNamespace,
          config.outputName
        )
      );
      continue;
    }

    if (
      symbol.kind === "interface" &&
      symbol.declaration.kind === "interfaceDeclaration"
    ) {
      typeBindings.push(
        buildTypeBindingFromInterface(
          symbol.declaration,
          symbol.declaringNamespace,
          config.outputName
        )
      );
      continue;
    }

    if (
      symbol.kind === "enum" &&
      symbol.declaration.kind === "enumDeclaration"
    ) {
      typeBindings.push(
        buildTypeBindingFromEnum(
          symbol.declaration,
          symbol.declaringNamespace,
          config.outputName
        )
      );
      continue;
    }

    if (
      symbol.kind === "typeAlias" &&
      symbol.declaration.kind === "typeAliasDeclaration"
    ) {
      const binding = buildTypeBindingFromStructuralAlias(
        symbol.declaration,
        symbol.declaringNamespace,
        config.outputName
      );
      if (binding) typeBindings.push(binding);
    }
  }

  const internalSourceAliasLines =
    plan.sourceAliasLines.length > 0
      ? [
          "",
          "// Tsonic source type aliases (generated)",
          ...plan.sourceAliasLines,
          "// End Tsonic source type aliases",
        ]
      : [];
  const requiredInternalTypeImports = selectSourceTypeImportsForRenderedText(
    [...internalSourceAliasLines, ...internalBodyLines].join("\n"),
    plan.internalTypeImports
  );

  const internalLines: string[] = [];
  internalLines.push("// Generated by Tsonic - Source bindings");
  internalLines.push(`// Namespace: ${plan.namespace}`);
  internalLines.push(`// Assembly: ${config.outputName}`);
  internalLines.push("");
  internalLines.push(primitiveImportLine);
  if (requiredInternalTypeImports.length > 0) {
    internalLines.push("");
    internalLines.push("// Tsonic source type imports (generated)");
    for (const typeImport of requiredInternalTypeImports) {
      if (typeImport.importedName === typeImport.localName) {
        internalLines.push(
          `import type { ${typeImport.importedName} } from '${typeImport.source}';`
        );
        continue;
      }
      internalLines.push(
        `import type { ${typeImport.importedName} as ${typeImport.localName} } from '${typeImport.source}';`
      );
    }
    internalLines.push("// End Tsonic source type imports");
  }
  if (plan.wrapperImports.length > 0) {
    internalLines.push("");
    internalLines.push("// Tsonic source member type imports (generated)");
    for (const wrapperImport of plan.wrapperImports) {
      if (wrapperImport.importedName === wrapperImport.aliasName) {
        internalLines.push(
          `import type { ${wrapperImport.importedName} } from '${wrapperImport.source}';`
        );
        continue;
      }
      internalLines.push(
        `import type { ${wrapperImport.importedName} as ${wrapperImport.aliasName} } from '${wrapperImport.source}';`
      );
    }
    internalLines.push("// End Tsonic source member type imports");
  }
  internalLines.push("");
  if (internalSourceAliasLines.length > 0) {
    internalLines.push(...internalSourceAliasLines);
    internalLines.push("");
  }
  internalLines.push(...internalBodyLines);

  writeFileSync(
    internalIndexPath,
    internalLines.join("\n").trimEnd() + "\n",
    "utf-8"
  );

  const internalSpecifier = moduleNamespaceToInternalSpecifier(plan.namespace);

  const facadeLines: string[] = [];
  facadeLines.push(`// Namespace: ${plan.namespace}`);
  facadeLines.push("// Generated by Tsonic - Source bindings");
  facadeLines.push("");
  facadeLines.push(`import * as Internal from '${internalSpecifier}';`);
  facadeLines.push("");

  for (const symbol of plan.typeDeclarations) {
    if (symbol.kind === "typeAlias") {
      continue;
    }
    const isValueType = symbol.kind === "class" || symbol.kind === "enum";
    const isSyntheticAnonymousClass =
      symbol.kind === "class" && symbol.localName.startsWith("__Anon_");
    if (isValueType) {
      const specifier =
        symbol.exportName === symbol.localName
          ? symbol.exportName
          : `${symbol.localName} as ${symbol.exportName}`;
      if (!isSyntheticAnonymousClass) {
        facadeLines.push(
          `export { ${specifier} } from '${internalSpecifier}';`
        );
      }
      facadeLines.push(
        `export type { ${specifier} } from '${internalSpecifier}';`
      );
      if (symbol.kind === "class") {
        facadeLines.push(
          `export type { ${symbol.localName}$instance } from '${internalSpecifier}';`
        );
      }
      continue;
    }

    const specifier =
      symbol.exportName === symbol.localName
        ? symbol.exportName
        : `${symbol.localName} as ${symbol.exportName}`;
    facadeLines.push(
      `export type { ${specifier} } from '${internalSpecifier}';`
    );
    if (symbol.kind === "interface") {
      facadeLines.push(
        `export type { ${symbol.localName}$instance } from '${internalSpecifier}';`
      );
    }
  }

  for (const container of plan.moduleContainers) {
    facadeLines.push(
      `export { ${container.module.className}$instance as ${container.module.className} } from '${internalSpecifier}';`
    );
  }

  const valueBindings = new Map<string, FirstPartyBindingsExport>();

  const localTypeImports = new Set<string>();
  for (const symbol of plan.typeDeclarations) {
    if (symbol.kind === "typeAlias") continue;
    localTypeImports.add(symbol.localName);
    if (symbol.kind === "class" || symbol.kind === "interface") {
      localTypeImports.add(`${symbol.localName}$instance`);
    }
  }
  for (const internalImport of plan.sourceAliasInternalImports) {
    localTypeImports.add(internalImport);
  }
  for (const helper of plan.internalHelperTypeDeclarations) {
    localTypeImports.add(helper.emittedName);
  }

  if (localTypeImports.size > 0) {
    facadeLines.push("");
    facadeLines.push("// Tsonic source alias imports (generated)");
    facadeLines.push(
      `import type { ${Array.from(localTypeImports.values())
        .sort((left, right) => left.localeCompare(right))
        .join(", ")} } from '${internalSpecifier}';`
    );
    facadeLines.push("// End Tsonic source alias imports");
  }

  if (plan.sourceAliasLines.length > 0) {
    facadeLines.push("");
    facadeLines.push("// Tsonic source type aliases (generated)");
    facadeLines.push(...plan.sourceAliasLines);
    facadeLines.push("// End Tsonic source type aliases");
  }

  if (plan.crossNamespaceReexports.dtsStatements.length > 0) {
    facadeLines.push("");
    facadeLines.push("// Tsonic cross-namespace re-exports (generated)");
    facadeLines.push(...plan.crossNamespaceReexports.dtsStatements);
    facadeLines.push("// End Tsonic cross-namespace re-exports");
  }

  for (const valueExport of plan.valueExports) {
    valueBindings.set(valueExport.exportName, valueExport.binding);
    if (valueExport.facade.kind === "function") {
      const sourceSignature = renderSourceFunctionSignature({
        declaration: valueExport.facade.declaration,
        sourceSignatures: valueExport.facade.sourceSignatures ?? [],
        localTypeNameRemaps: valueExport.facade.localTypeNameRemaps,
        anonymousStructuralAliases,
      });
      facadeLines.push(
        sourceSignature
          ? `export declare function ${valueExport.exportName}${sourceSignature.typeParametersText}(${sourceSignature.parametersText}): ${sourceSignature.returnTypeText};`
          : `export declare function ${valueExport.exportName}${printTypeParameters(
              valueExport.facade.declaration.typeParameters
            )}(${renderUnknownParameters(
              valueExport.facade.declaration.parameters,
              valueExport.facade.declaration.typeParameters?.map(
                (typeParameter) => typeParameter.name
              ) ?? [],
              valueExport.facade.localTypeNameRemaps
            )}): ${renderPortableType(
              valueExport.facade.declaration.returnType,
              valueExport.facade.declaration.typeParameters?.map(
                (typeParameter) => typeParameter.name
              ) ?? [],
              valueExport.facade.localTypeNameRemaps
            )};`
      );
      continue;
    }

    const sourceFunctionTypeText = renderSourceFunctionType({
      sourceSignatures: valueExport.facade.sourceSignatures ?? [],
      localTypeNameRemaps: valueExport.facade.localTypeNameRemaps,
      anonymousStructuralAliases,
    });
    const sourceTypeText =
      sourceFunctionTypeText ??
      renderSourceValueType(
        valueExport.facade.sourceType,
        valueExport.facade.localTypeNameRemaps,
        anonymousStructuralAliases
      );
    facadeLines.push(
      `export declare const ${valueExport.exportName}: ${
        sourceTypeText ??
        renderPortableType(
          valueExport.facade.declarator?.type,
          [],
          valueExport.facade.localTypeNameRemaps
        )
      };`
    );
  }

  const requiredFacadeTypeImports = selectSourceTypeImportsForRenderedText(
    facadeLines.join("\n"),
    plan.facadeTypeImports
  );
  if (requiredFacadeTypeImports.length > 0) {
    facadeLines.splice(
      4,
      0,
      "",
      "// Tsonic source type imports (generated)",
      ...requiredFacadeTypeImports.map((typeImport) =>
        typeImport.importedName === typeImport.localName
          ? `import type { ${typeImport.importedName} } from '${typeImport.source}';`
          : `import type { ${typeImport.importedName} as ${typeImport.localName} } from '${typeImport.source}';`
      ),
      "// End Tsonic source type imports"
    );
  }

  if (
    plan.typeDeclarations.length === 0 &&
    plan.moduleContainers.length === 0 &&
    plan.valueExports.length === 0 &&
    plan.sourceAliasLines.length === 0 &&
    plan.crossNamespaceReexports.dtsStatements.length === 0
  ) {
    facadeLines.push("export {};");
  }

  writeFileSync(
    facadeDtsPath,
    facadeLines.join("\n").trimEnd() + "\n",
    "utf-8"
  );

  writeFileSync(
    facadeJsPath,
    [
      `// Namespace: ${plan.namespace}`,
      "// Generated by Tsonic - Source bindings",
      "// Module Stub - Do Not Execute",
      "",
      ...(plan.crossNamespaceReexports.jsValueStatements.length > 0
        ? [
            "// Tsonic cross-namespace value re-exports (generated)",
            ...plan.crossNamespaceReexports.jsValueStatements,
            "// End Tsonic cross-namespace value re-exports",
            "",
          ]
        : []),
      "throw new Error(",
      `  'Cannot import CLR namespace ${plan.namespace} in JavaScript runtime. ' +`,
      "  'This module provides TypeScript type definitions only. ' +",
      "  'Actual implementation requires .NET runtime via Tsonic compiler.'",
      ");",
      "",
    ].join("\n"),
    "utf-8"
  );

  const bindings: FirstPartyBindingsFile = {
    namespace: plan.namespace,
    contributingAssemblies: [config.outputName],
    types: typeBindings.sort((left, right) =>
      left.clrName.localeCompare(right.clrName)
    ),
    exports:
      valueBindings.size > 0
        ? Object.fromEntries(
            Array.from(valueBindings.entries()).sort((left, right) =>
              left[0].localeCompare(right[0])
            )
          )
        : undefined,
    producer: {
      tool: "tsonic",
      mode: "aikya-firstparty",
    },
  };

  writeFileSync(
    bindingsPath,
    JSON.stringify(bindings, null, 2) + "\n",
    "utf-8"
  );
  return { ok: true, value: undefined };
};

export const generateFirstPartyLibraryBindings = (
  config: ResolvedConfig,
  bindingsOutDir: string
): Result<void, string> => {
  if (!config.entryPoint) {
    return {
      ok: false,
      error:
        "Library bindings generation requires an entryPoint in tsonic.json.",
    };
  }

  const absoluteEntryPoint = resolve(config.projectRoot, config.entryPoint);
  const absoluteSourceRoot = resolve(config.projectRoot, config.sourceRoot);
  const surfaceCapabilities = resolveSurfaceCapabilities(config.surface, {
    workspaceRoot: config.workspaceRoot,
  });

  const typeLibraries = config.libraries.filter(
    (library) => !library.endsWith(".dll")
  );
  const allTypeRoots = [...config.typeRoots, ...typeLibraries].map((typeRoot) =>
    resolve(config.workspaceRoot, typeRoot)
  );

  const compilerOptions: CompilerOptions = {
    projectRoot: config.projectRoot,
    sourceRoot: absoluteSourceRoot,
    rootNamespace: config.rootNamespace,
    typeRoots: allTypeRoots,
    surface: config.surface,
    useStandardLib: surfaceCapabilities.useStandardLib,
    verbose: false,
  };

  const graphResult = buildModuleDependencyGraph(
    absoluteEntryPoint,
    compilerOptions
  );
  if (!graphResult.ok) {
    const message = graphResult.error
      .map((diagnostic) =>
        diagnostic.location
          ? `${diagnostic.location.file}:${diagnostic.location.line}:${diagnostic.location.column} ${diagnostic.message}`
          : diagnostic.message
      )
      .join("\n");
    return {
      ok: false,
      error: `Failed to generate first-party bindings from source:\n${message}`,
    };
  }

  rmSync(bindingsOutDir, { recursive: true, force: true });
  mkdirSync(bindingsOutDir, { recursive: true });

  const sourceIndexByFileKey = new Map<string, ModuleSourceIndex>();
  for (const module of graphResult.value.modules) {
    if (module.filePath.startsWith("__tsonic/")) continue;
    const moduleKey = normalizeModuleFileKey(module.filePath);
    const absolutePath = resolve(absoluteSourceRoot, moduleKey);
    const indexed = buildModuleSourceIndex(absolutePath, moduleKey);
    if (!indexed.ok) return indexed;
    sourceIndexByFileKey.set(moduleKey, indexed.value);
  }

  const plansResult = collectNamespacePlans(
    graphResult.value.modules,
    config.outputName,
    config.rootNamespace,
    sourceIndexByFileKey
  );
  if (!plansResult.ok) return plansResult;

  for (const plan of plansResult.value) {
    const result = writeNamespaceArtifacts(config, bindingsOutDir, plan);
    if (!result.ok) return result;
  }

  const overlayResult = overlayDependencyBindings(config, bindingsOutDir);
  if (!overlayResult.ok) return overlayResult;

  return { ok: true, value: undefined };
};
