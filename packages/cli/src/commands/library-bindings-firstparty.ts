import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, posix, resolve } from "node:path";
import type {
  CompilerOptions,
  IrClassDeclaration,
  IrEnumDeclaration,
  IrInterfaceDeclaration,
  IrModule,
  IrParameter,
  IrStatement,
  IrType,
  IrTypeAliasDeclaration,
  IrTypeParameter,
} from "@tsonic/frontend";
import { buildModuleDependencyGraph } from "@tsonic/frontend";
import { resolveSurfaceCapabilities } from "../surface/profiles.js";
import type { ResolvedConfig, Result } from "../types.js";
import {
  augmentLibraryBindingsFromSource,
  overlayDependencyBindings,
} from "./library-bindings-augment.js";

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
  }[];
};

type NamespacePlan = {
  readonly namespace: string;
  readonly typeDeclarations: readonly ExportedSymbol[];
  readonly moduleContainers: readonly ModuleContainerEntry[];
  readonly exportedFunctions: readonly {
    readonly exportName: string;
    readonly declaration: Extract<IrStatement, { kind: "functionDeclaration" }>;
  }[];
  readonly exportedVariables: readonly {
    readonly exportName: string;
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
  }[];
  readonly exportsMap: Readonly<Record<string, FirstPartyBindingsExport>>;
};

const primitiveImportLine =
  "import type { sbyte, byte, short, ushort, int, uint, long, ulong, int128, uint128, half, float, double, decimal, nint, nuint, char } from '@tsonic/core/types.js';";

const sanitizeForBrand = (value: string): string => {
  const normalized = value.replace(/[^A-Za-z0-9_]/g, "_");
  return normalized.length > 0 ? normalized : "_";
};

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
  typeParametersInScope: readonly string[]
): string => {
  if (typeParametersInScope.includes(referenceName)) return referenceName;
  if (referenceName === "unknown") return "unknown";
  if (referenceName === "any") return "unknown";
  if (referenceName === "object") return "object";
  if (referenceName === "string") return "string";
  if (referenceName === "boolean") return "boolean";
  if (referenceName === "number") return "number";

  let normalizedName = normalizeTypeReferenceName(referenceName);
  if (typeArguments && typeArguments.length > 0) {
    const arityMatch = normalizedName.match(/_(\d+)$/);
    if (
      arityMatch &&
      arityMatch[1] &&
      Number(arityMatch[1]) === typeArguments.length &&
      !normalizedName.includes("__Alias_")
    ) {
      normalizedName = normalizedName.slice(0, -arityMatch[0].length);
    }
  }
  if (!typeArguments || typeArguments.length === 0) return normalizedName;
  return `${normalizedName}<${typeArguments
    .map((arg) => renderPortableType(arg, typeParametersInScope))
    .join(", ")}>`;
};

const renderPortableType = (
  type: IrType | undefined,
  typeParametersInScope: readonly string[] = []
): string => {
  if (!type) return "object";

  switch (type.kind) {
    case "primitiveType":
      return type.name;
    case "literalType":
      return typeof type.value === "string"
        ? JSON.stringify(type.value)
        : String(type.value);
    case "voidType":
      return "void";
    case "neverType":
      return "never";
    case "unknownType":
    case "anyType":
      return "unknown";
    case "typeParameterType":
      return type.name;
    case "arrayType":
      return `${renderPortableType(type.elementType, typeParametersInScope)}[]`;
    case "tupleType":
      return `[${type.elementTypes
        .map((item) => renderPortableType(item, typeParametersInScope))
        .join(", ")}]`;
    case "unionType":
      return type.types
        .map((item) => renderPortableType(item, typeParametersInScope))
        .join(" | ");
    case "intersectionType":
      return type.types
        .map((item) => renderPortableType(item, typeParametersInScope))
        .join(" & ");
    case "dictionaryType":
      return `Record<${renderPortableType(
        type.keyType,
        typeParametersInScope
      )}, ${renderPortableType(type.valueType, typeParametersInScope)}>`;
    case "functionType":
      return `(${type.parameters
        .map((parameter, index) => {
          const parameterName =
            parameter.pattern.kind === "identifierPattern"
              ? parameter.pattern.name
              : `p${index + 1}`;
          return `${parameterName}: ${renderPortableType(parameter.type, typeParametersInScope)}`;
        })
        .join(
          ", "
        )}) => ${renderPortableType(type.returnType, typeParametersInScope)}`;
    case "objectType":
      return `{ ${type.members
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
                return `${parameterName}${optionalMark}: ${renderPortableType(
                  parameter.type,
                  typeParametersInScope
                )}`;
              })
              .join(", ")}): ${renderPortableType(
              member.returnType,
              typeParametersInScope
            )}`;
          }
          const optionalMark = member.isOptional ? "?" : "";
          const readonlyMark = member.isReadonly ? "readonly " : "";
          return `${readonlyMark}${member.name}${optionalMark}: ${renderPortableType(
            member.type,
            typeParametersInScope
          )}`;
        })
        .join("; ")} }`;
    case "referenceType": {
      return renderReferenceType(
        type.name,
        type.typeArguments,
        typeParametersInScope
      );
    }
    default:
      return "object";
  }
};

const renderUnknownParameters = (
  parameters: readonly IrParameter[],
  typeParametersInScope: readonly string[]
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
        typeParametersInScope
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
  returnType: IrType | undefined
): string => {
  const typeParametersText = printTypeParameters(typeParameters);
  const typeParameterNames =
    typeParameters?.map((typeParameter) => typeParameter.name) ?? [];
  const parametersText = renderUnknownParameters(
    parameters,
    typeParameterNames
  );
  const returnTypeText = renderPortableType(returnType, typeParameterNames);
  return `${name}${typeParametersText}(${parametersText}): ${returnTypeText};`;
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
    });
  }

  return {
    ok: true,
    value: exportedSymbols.sort((left, right) =>
      left.exportName.localeCompare(right.exportName)
    ),
  };
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
          error:
            `Unable to re-export '${localName}' from ${module.filePath}: namespace imports are not supported for first-party bindings generation.`,
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
  typeParametersInScope: readonly string[]
): string => {
  if (!type) return "System.Object";

  switch (type.kind) {
    case "primitiveType":
      return primitiveSignatureType(type.name);
    case "literalType":
      return typeof type.value === "string" ? "System.String" : "System.Double";
    case "voidType":
      return "System.Void";
    case "neverType":
    case "unknownType":
    case "anyType":
      return "System.Object";
    case "typeParameterType":
      return type.name;
    case "arrayType":
      return `${toSignatureType(type.elementType, typeParametersInScope)}[]`;
    case "tupleType":
    case "objectType":
    case "functionType":
    case "dictionaryType":
      return "System.Object";
    case "intersectionType":
      return toSignatureType(type.types[0], typeParametersInScope);
    case "unionType": {
      const nonUndefined = type.types.filter((candidate) => {
        return !(
          candidate.kind === "primitiveType" && candidate.name === "undefined"
        );
      });
      if (nonUndefined.length === 1 && nonUndefined[0]) {
        const single = toSignatureType(nonUndefined[0], typeParametersInScope);
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
        type.name,
        type.typeArguments?.length
      );
      if (!type.typeArguments || type.typeArguments.length === 0) {
        return normalizedName;
      }
      const args = type.typeArguments
        .map((arg) => toSignatureType(arg, typeParametersInScope))
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
    .map((parameter) => toSignatureType(parameter.type, typeParameterScope))
    .join(",")}):${toSignatureType(
    opts.returnType,
    typeParameterScope
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
  namespace: string
): readonly string[] => {
  const lines: string[] = [];
  const typeParameterScope = (declaration.typeParameters ?? []).map(
    (typeParameter) => typeParameter.name
  );
  const typeParameters = printTypeParameters(declaration.typeParameters);
  const markerName = `__tsonic_type_${sanitizeForBrand(namespace)}_${sanitizeForBrand(declaration.name)}`;
  const heritageNames = [
    declaration.superClass
      ? renderPortableType(declaration.superClass, typeParameterScope)
      : undefined,
    ...declaration.implements.map((implementedType) =>
      renderPortableType(implementedType, typeParameterScope)
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
    `export interface ${declaration.name}$instance${typeParameters}${extendsClause} {`
  );
  lines.push(`    readonly ${markerName}: never;`);

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
          member.returnType
        )}`
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
      const memberType = renderPortableType(member.type);

      if (hasGetter && !hasSetter) {
        lines.push(`    readonly ${member.name}: ${memberType};`);
        continue;
      }
      if (hasGetter) {
        lines.push(`    get ${member.name}(): ${memberType};`);
      }
      if (hasSetter) {
        lines.push(`    set ${member.name}(value: ${memberType});`);
      }
    }
  }

  lines.push("}");
  lines.push("");
  lines.push(`export const ${declaration.name}: {`);
  lines.push(
    `    new(...args: unknown[]): ${declaration.name}${typeParameters};`
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
          member.returnType
        )}`
      );
      continue;
    }
    if (member.kind === "propertyDeclaration") {
      lines.push(`    ${member.name}: ${renderPortableType(member.type)};`);
    }
  }

  lines.push("};");
  lines.push("");
  lines.push(
    `export type ${declaration.name}${typeParameters} = ${declaration.name}$instance${typeParameters};`
  );
  lines.push("");

  return lines;
};

const renderInterfaceInternal = (
  declaration: IrInterfaceDeclaration,
  namespace: string
): readonly string[] => {
  const lines: string[] = [];
  const typeParameterScope = (declaration.typeParameters ?? []).map(
    (typeParameter) => typeParameter.name
  );
  const typeParameters = printTypeParameters(declaration.typeParameters);
  const markerName = `__tsonic_type_${sanitizeForBrand(namespace)}_${sanitizeForBrand(declaration.name)}`;
  const extendsNames = declaration.extends
    .map((baseType) => renderPortableType(baseType, typeParameterScope).trim())
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
    `export interface ${declaration.name}$instance${typeParameters}${extendsClause} {`
  );
  lines.push(`    readonly ${markerName}: never;`);
  for (const member of declaration.members) {
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
      const optionalMark = member.isOptional ? "?" : "";
      lines.push(
        `    ${member.name}${optionalMark}: ${renderPortableType(member.type)};`
      );
    }
  }
  lines.push("}");
  lines.push("");
  lines.push(
    `export type ${declaration.name}${typeParameters} = ${declaration.name}$instance${typeParameters};`
  );
  lines.push("");
  return lines;
};

const renderEnumInternal = (
  declaration: IrEnumDeclaration
): readonly string[] => {
  const lines: string[] = [];
  lines.push(`export enum ${declaration.name} {`);
  declaration.members.forEach((member, index) => {
    lines.push(`    ${member.name} = ${index},`);
  });
  lines.push("}");
  lines.push("");
  return lines;
};

const renderStructuralAliasInternal = (
  declaration: IrTypeAliasDeclaration,
  namespace: string
): readonly string[] => {
  if (declaration.type.kind !== "objectType") return [];

  const lines: string[] = [];
  const arity = declaration.typeParameters?.length ?? 0;
  const typeParameters = printTypeParameters(declaration.typeParameters);
  const internalAliasName = `${declaration.name}__Alias${arity > 0 ? `_${arity}` : ""}`;
  const markerName = `__tsonic_type_${sanitizeForBrand(namespace)}_${sanitizeForBrand(internalAliasName)}`;

  lines.push(
    `export interface ${internalAliasName}$instance${typeParameters} {`
  );
  lines.push(`    readonly ${markerName}: never;`);
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
      const optionalMark = member.isOptional ? "?" : "";
      lines.push(
        `    ${member.name}${optionalMark}: ${renderPortableType(member.type)};`
      );
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

const renderContainerInternal = (
  entry: ModuleContainerEntry
): readonly string[] => {
  const lines: string[] = [];
  lines.push(`export abstract class ${entry.module.className}$instance {`);
  for (const method of entry.methods) {
    lines.push(
      `    static ${renderMethodSignature(
        method.localName,
        method.declaration.typeParameters,
        method.declaration.parameters,
        method.declaration.returnType
      )}`
    );
  }
  for (const variable of entry.variables) {
    lines.push(
      `    static ${variable.localName}: ${renderPortableType(variable.declarator?.type)};`
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
  assemblyName: string
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
            toSignatureType(parameter.type, typeParameterScope)
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
      const propertyType = toSignatureType(member.type, typeParameterScope);

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
  assemblyName: string
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
        })
      );
      continue;
    }

    properties.push({
      stableId: `${typeStableId}::property:${member.name}`,
      clrName: member.name,
      normalizedSignature: `${member.name}|:${toSignatureType(
        member.type,
        typeParameterScope
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
  assemblyName: string
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
        })
      );
      continue;
    }

    properties.push({
      stableId: `${typeStableId}::property:${member.name}`,
      clrName: member.name,
      normalizedSignature: `${member.name}|:${toSignatureType(
        member.type,
        typeParameterScope
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
    })
  );

  const properties: FirstPartyBindingsProperty[] = entry.variables.map(
    (variable) => ({
      stableId: `${typeStableId}::property:${variable.localName}`,
      clrName: variable.localName,
      normalizedSignature: `${variable.localName}|:${toSignatureType(
        variable.declarator?.type,
        []
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
  assemblyName: string
): Result<readonly NamespacePlan[], string> => {
  const modulesByNamespace = new Map<string, IrModule[]>();
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
    const exportedFunctions: {
      exportName: string;
      declaration: Extract<IrStatement, { kind: "functionDeclaration" }>;
    }[] = [];
    const exportedVariables: {
      exportName: string;
      declarator:
        | {
            readonly kind: "variableDeclarator";
            readonly name: {
              readonly kind: "identifierPattern";
              readonly name: string;
            };
            readonly type?: IrType;
          }
        | undefined;
    }[] = [];
    const exportsMap = new Map<string, FirstPartyBindingsExport>();
    const seenTypeDeclarationKeys = new Set<string>();

    for (const module of moduleList.sort((left, right) =>
      left.filePath.localeCompare(right.filePath)
    )) {
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
        if (exportKind.value === "function") {
          exportsMap.set(exportItem.name, {
            kind: "method",
            clrName: resolved.value.clrName,
            declaringClrType: toClrTypeName(
              declarationModule.namespace,
              declarationModule.className
            ),
            declaringAssemblyName: assemblyName,
          });
          continue;
        }
        if (exportKind.value === "variable") {
          exportsMap.set(exportItem.name, {
            kind: "field",
            clrName: resolved.value.clrName,
            declaringClrType: toClrTypeName(
              declarationModule.namespace,
              declarationModule.className
            ),
            declaringAssemblyName: assemblyName,
          });
          continue;
        }

        if (
          exportKind.value === "class" ||
          exportKind.value === "interface" ||
          exportKind.value === "enum" ||
          exportKind.value === "typeAlias"
        ) {
          if (
            exportKind.value === "typeAlias" &&
            declaration.kind === "typeAliasDeclaration" &&
            declaration.type.kind !== "objectType"
          ) {
            continue;
          }
          const typeKey = `${declarationModule.filePath}|${resolved.value.clrName}|${exportKind.value}`;
          if (seenTypeDeclarationKeys.has(typeKey)) continue;
          seenTypeDeclarationKeys.add(typeKey);
          typeDeclarations.push({
            exportName: exportItem.name,
            localName: resolved.value.clrName,
            kind: exportKind.value,
            declaration,
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
          if (
            symbol.kind === "typeAlias" &&
            symbol.declaration.kind === "typeAliasDeclaration" &&
            symbol.declaration.type.kind !== "objectType"
          ) {
            continue;
          }
          const key = `${symbol.localName}|${symbol.kind}`;
          if (!seenTypeDeclarationKeys.has(key)) {
            seenTypeDeclarationKeys.add(key);
            typeDeclarations.push(symbol);
          }
        }

        if (symbol.kind === "function") {
          const functionDeclaration =
            symbol.declaration.kind === "functionDeclaration"
              ? symbol.declaration
              : undefined;
          if (!functionDeclaration) continue;
          containerMethods.push({
            exportName: symbol.exportName,
            localName: symbol.localName,
            declaration: functionDeclaration,
          });
          exportedFunctions.push({
            exportName: symbol.exportName,
            declaration: functionDeclaration,
          });
          exportsMap.set(symbol.exportName, {
            kind: "method",
            clrName: symbol.localName,
            declaringClrType: toClrTypeName(namespace, module.className),
            declaringAssemblyName: assemblyName,
          });
          continue;
        }

        if (symbol.kind === "variable") {
          const declaration =
            symbol.declaration.kind === "variableDeclaration"
              ? symbol.declaration
              : undefined;
          if (!declaration) continue;
          const declarator = declaration.declarations.find(
            (candidate) =>
              candidate.name.kind === "identifierPattern" &&
              candidate.name.name === symbol.localName
          );
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
          });
          exportedVariables.push({
            exportName: symbol.exportName,
            declarator:
              declarator && declarator.name.kind === "identifierPattern"
                ? {
                    kind: declarator.kind,
                    name: declarator.name,
                    type: declarator.type,
                  }
                : undefined,
          });
          exportsMap.set(symbol.exportName, {
            kind: "field",
            clrName: symbol.localName,
            declaringClrType: toClrTypeName(namespace, module.className),
            declaringAssemblyName: assemblyName,
          });
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
      moduleContainers: moduleContainers.sort((left, right) =>
        left.module.className.localeCompare(right.module.className)
      ),
      exportedFunctions: exportedFunctions.sort((left, right) =>
        left.exportName.localeCompare(right.exportName)
      ),
      exportedVariables: exportedVariables.sort((left, right) =>
        left.exportName.localeCompare(right.exportName)
      ),
      exportsMap: Object.fromEntries(
        Array.from(exportsMap.entries()).sort((left, right) =>
          left[0].localeCompare(right[0])
        )
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

  const internalLines: string[] = [];
  internalLines.push("// Generated by Tsonic - Source bindings");
  internalLines.push(`// Namespace: ${plan.namespace}`);
  internalLines.push(`// Assembly: ${config.outputName}`);
  internalLines.push("");
  internalLines.push(primitiveImportLine);
  internalLines.push("");

  const typeBindings: FirstPartyBindingsType[] = [];

  for (const symbol of plan.typeDeclarations) {
    if (
      symbol.kind === "class" &&
      symbol.declaration.kind === "classDeclaration"
    ) {
      internalLines.push(
        ...renderClassInternal(symbol.declaration, plan.namespace)
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
      internalLines.push(
        ...renderInterfaceInternal(symbol.declaration, plan.namespace)
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
      internalLines.push(...renderEnumInternal(symbol.declaration));
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
      internalLines.push(
        ...renderStructuralAliasInternal(symbol.declaration, plan.namespace)
      );
      const binding = buildTypeBindingFromStructuralAlias(
        symbol.declaration,
        plan.namespace,
        config.outputName
      );
      if (binding) typeBindings.push(binding);
    }
  }

  for (const container of plan.moduleContainers) {
    internalLines.push(...renderContainerInternal(container));
    typeBindings.push(
      buildTypeBindingFromContainer(
        container,
        plan.namespace,
        config.outputName
      )
    );
  }

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
    if (isValueType) {
      const specifier =
        symbol.exportName === symbol.localName
          ? symbol.exportName
          : `${symbol.localName} as ${symbol.exportName}`;
      facadeLines.push(`export { ${specifier} } from '${internalSpecifier}';`);
      continue;
    }

    const specifier =
      symbol.exportName === symbol.localName
        ? symbol.exportName
        : `${symbol.localName} as ${symbol.exportName}`;
    facadeLines.push(
      `export type { ${specifier} } from '${internalSpecifier}';`
    );
  }

  for (const container of plan.moduleContainers) {
    facadeLines.push(
      `export { ${container.module.className}$instance as ${container.module.className} } from '${internalSpecifier}';`
    );
  }

  for (const fn of plan.exportedFunctions) {
    const typeParametersText = printTypeParameters(
      fn.declaration.typeParameters
    );
    const typeParameterNames =
      fn.declaration.typeParameters?.map(
        (typeParameter) => typeParameter.name
      ) ?? [];
    const parametersText = renderUnknownParameters(
      fn.declaration.parameters,
      typeParameterNames
    );
    const returnTypeText = renderPortableType(
      fn.declaration.returnType,
      typeParameterNames
    );
    facadeLines.push(
      `export declare function ${fn.exportName}${typeParametersText}(${parametersText}): ${returnTypeText};`
    );
  }

  for (const variable of plan.exportedVariables) {
    facadeLines.push(
      `export declare const ${variable.exportName}: ${renderPortableType(
        variable.declarator?.type
      )};`
    );
  }

  if (
    plan.typeDeclarations.length === 0 &&
    plan.moduleContainers.length === 0 &&
    plan.exportedFunctions.length === 0 &&
    plan.exportedVariables.length === 0
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
      Object.keys(plan.exportsMap).length > 0 ? plan.exportsMap : undefined,
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
  const surfaceCapabilities = resolveSurfaceCapabilities(config.surface);

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

  const plansResult = collectNamespacePlans(
    graphResult.value.modules,
    config.outputName
  );
  if (!plansResult.ok) return plansResult;

  for (const plan of plansResult.value) {
    const result = writeNamespaceArtifacts(config, bindingsOutDir, plan);
    if (!result.ok) return result;
  }

  const overlayResult = overlayDependencyBindings(config, bindingsOutDir);
  if (!overlayResult.ok) return overlayResult;

  const augmentResult = augmentLibraryBindingsFromSource(
    config,
    bindingsOutDir
  );
  if (!augmentResult.ok) return augmentResult;

  // Ensure root namespace facade exists when source-level augmentation emitted only
  // root-level re-exports.
  const rootFacade = join(
    bindingsOutDir,
    `${moduleNamespacePath(config.rootNamespace)}.d.ts`
  );
  if (!existsSync(rootFacade)) {
    const internalSpecifier = moduleNamespaceToInternalSpecifier(
      config.rootNamespace
    );
    mkdirSync(dirname(rootFacade), { recursive: true });
    writeFileSync(
      rootFacade,
      [
        `// Namespace: ${config.rootNamespace}`,
        "// Generated by Tsonic - Source bindings",
        "",
        `import * as Internal from '${internalSpecifier}';`,
        "",
        "export {};",
        "",
      ].join("\n"),
      "utf-8"
    );
  }

  return { ok: true, value: undefined };
};
