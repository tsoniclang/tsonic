import { TstsProviderContractVersion, createSourceSemanticsExtension, sourcePrimitive } from "@tsonic/tsts";
import type {
  CompilerExtension,
  ExtensionDiagnostic,
  ProviderDeclarationModel,
  ProviderExportDeclaration,
  ProviderIdentity,
  ProviderModuleContext,
  ProviderModuleResolution,
  ProviderOwnership,
  ProviderTypeExpression,
  SourceCallMarkerDeclaration,
  SourcePrimitiveDeclaration,
  SourcePrimitiveKind,
  SourceSemanticsExportDeclaration,
  SourceSemanticsModule,
  SourceTypeMarkerDeclaration,
  TargetBindingProvider,
} from "@tsonic/tsts";
import type { TargetExtensionContext } from "@tsonic/target-api";

export const neutralTypesModule = "@tsonic/core/types.js";
export const csharpTypesModule = "@tsonic/csharp/types.js";
export const neutralLangModule = "@tsonic/core/lang.js";

export function createCsharpSourceSemanticsExtension(_context: TargetExtensionContext): CompilerExtension {
  return createSourceSemanticsExtension({
    identity: {
      id: "tsonic.csharp.source-semantics",
      version: "0.0.1",
      capabilityNamespace: "tsonic.csharp.source",
    },
    modules: csharpSourceSemanticsModules(),
  });
}

export function createCsharpCoreVirtualModulesExtension(_context: TargetExtensionContext): CompilerExtension {
  return {
    identity: {
      id: "tsonic.csharp.core-virtual-modules",
      version: "0.0.1",
      capabilityNamespace: "tsonic.csharp.core-modules",
    },
    composition: {
      kind: "target",
      target: "csharp",
    },
    initialize(context): void {
      context.registerTargetBindingProvider(createCsharpCoreVirtualModulesProvider());
    },
  };
}

function csharpSourceSemanticsModules(): readonly SourceSemanticsModule[] {
  return [
    {
      moduleSpecifier: neutralTypesModule,
      packageName: "@tsonic/core",
      subpath: "types.js",
      exports: [
        sourcePrimitive("bool", "bool", "boolean"),
        sourcePrimitive("char", "char", "string", false, 16),
        sourcePrimitive("int8", "int8", "number", true, 8),
        sourcePrimitive("uint8", "uint8", "number", false, 8),
        sourcePrimitive("int16", "int16", "number", true, 16),
        sourcePrimitive("uint16", "uint16", "number", false, 16),
        sourcePrimitive("int32", "int32", "number", true, 32),
        sourcePrimitive("uint32", "uint32", "number", false, 32),
        sourcePrimitive("int64", "int64", "bigint", true, 64),
        sourcePrimitive("uint64", "uint64", "bigint", false, 64),
        sourcePrimitive("float32", "float32", "number", true, 32),
        sourcePrimitive("float64", "float64", "number", true, 64),
        sourcePrimitive("decimal", "decimal", "number", true, 128),
      ],
    },
    {
      moduleSpecifier: csharpTypesModule,
      packageName: "@tsonic/csharp",
      subpath: "types.js",
      exports: [
        sourcePrimitive("bool", "bool", "boolean"),
        sourcePrimitive("byte", "uint8", "number", false, 8),
        sourcePrimitive("sbyte", "int8", "number", true, 8),
        sourcePrimitive("short", "int16", "number", true, 16),
        sourcePrimitive("ushort", "uint16", "number", false, 16),
        sourcePrimitive("int", "int32", "number", true, 32),
        sourcePrimitive("uint", "uint32", "number", false, 32),
        sourcePrimitive("long", "int64", "bigint", true, 64),
        sourcePrimitive("ulong", "uint64", "bigint", false, 64),
        sourcePrimitive("float", "float32", "number", true, 32),
        sourcePrimitive("double", "float64", "number", true, 64),
        sourcePrimitive("decimal", "decimal", "number", true, 128),
        sourcePrimitive("char", "char", "string", false, 16),
      ],
    },
    {
      moduleSpecifier: neutralLangModule,
      packageName: "@tsonic/core",
      subpath: "lang.js",
      exports: [
        { kind: "call-marker", exportName: "out", marker: "out" },
        { kind: "call-marker", exportName: "ref", marker: "ref" },
        { kind: "call-marker", exportName: "inref", marker: "inref" },
        { kind: "call-marker", exportName: "struct", marker: "struct" },
        { kind: "call-marker", exportName: "field", marker: "field" },
        { kind: "call-marker", exportName: "attribute", marker: "attribute" },
        { kind: "call-marker", exportName: "defaultof", marker: "defaultof" },
        { kind: "type-marker", exportName: "ptr", marker: "ptr" },
        { kind: "type-marker", exportName: "fnptr", marker: "fnptr" },
      ],
    },
  ];
}

function createCsharpCoreVirtualModulesProvider(): TargetBindingProvider {
  const modules = new Map(csharpSourceSemanticsModules().map((module) => [module.moduleSpecifier, module]));
  const identity: ProviderIdentity = {
    id: "tsonic.csharp.core-virtual-modules",
    version: "0.0.1",
    target: "csharp",
    extensionContractVersion: TstsProviderContractVersion,
    providerKind: "binding",
    displayName: "Tsonic C# source modules",
  };
  return {
    identity,
    ownsModule(specifier: string, _context: ProviderModuleContext): ProviderOwnership {
      return modules.has(specifier) ? { kind: "owned" } : { kind: "unowned" };
    },
    resolveModule(specifier: string, _context: ProviderModuleContext): ProviderModuleResolution | ExtensionDiagnostic {
      const module = modules.get(specifier);
      if (module === undefined) {
        return {
          extensionId: identity.id,
          extensionCode: "CSHARP_CORE_MODULE_UNOWNED",
          numericCode: 9100001,
          category: "error",
          message: `C# core provider does not own '${specifier}'.`,
        };
      }
      return {
        kind: "virtual",
        moduleSpecifier: specifier,
        virtualFileName: `tsts-provider://tsonic-csharp/${encodeURIComponent(specifier)}`,
        providerModuleId: specifier,
        ...(module.packageName !== undefined ? { packageName: module.packageName } : {}),
        ...(module.packageVersion !== undefined ? { packageVersion: module.packageVersion } : {}),
        evidence: [{ message: "C# target supplies source module as provider virtual module." }],
      };
    },
    getDeclarationModel(resolution: ProviderModuleResolution): ProviderDeclarationModel | ExtensionDiagnostic {
      const module = modules.get(resolution.moduleSpecifier);
      if (module === undefined) {
        return {
          extensionId: identity.id,
          extensionCode: "CSHARP_CORE_MODULE_DECLARATION_MISSING",
          numericCode: 9100002,
          category: "error",
          message: `No C# core declaration model exists for '${resolution.moduleSpecifier}'.`,
        };
      }
      return {
        moduleSpecifier: resolution.moduleSpecifier,
        providerModuleId: resolution.providerModuleId,
        exports: module.exports.map(toProviderExportDeclaration),
        evidence: [{ message: "Declaration model is generated from target source semantics." }],
      };
    },
    getTargetIdentity(symbol) {
      if (symbol.exportName === undefined) {
        return undefined;
      }
      const module = modules.get(symbol.moduleSpecifier);
      const declaration = module?.exports.find((candidate) => candidate.exportName === symbol.exportName);
      if (declaration === undefined) {
        return undefined;
      }
      if (declaration.kind === "source-primitive") {
        return {
          target: "csharp",
          id: getCsharpPrimitiveTargetIdentity(declaration.primitive),
          displayName: getCsharpPrimitiveDisplayName(declaration.primitive),
        };
      }
      return {
        target: "csharp",
        id: `${symbol.moduleSpecifier}#${symbol.exportName}`,
        displayName: symbol.exportName,
      };
    },
  };
}

function toProviderExportDeclaration(declaration: SourceSemanticsExportDeclaration): ProviderExportDeclaration {
  switch (declaration.kind) {
    case "source-primitive":
      return primitiveExportToProviderDeclaration(declaration);
    case "call-marker":
      return callMarkerToProviderDeclaration(declaration);
    case "type-marker":
      return typeMarkerToProviderDeclaration(declaration);
  }
}

function primitiveExportToProviderDeclaration(declaration: SourcePrimitiveDeclaration): ProviderExportDeclaration {
  return {
    id: declaration.exportName,
    name: declaration.exportName,
    kind: "type",
    targetIdentity: {
      target: "csharp",
      id: getCsharpPrimitiveTargetIdentity(declaration.primitive),
      displayName: getCsharpPrimitiveDisplayName(declaration.primitive),
    },
    type: { kind: "source-primitive", name: declaration.primitive },
  };
}

function callMarkerToProviderDeclaration(declaration: SourceCallMarkerDeclaration): ProviderExportDeclaration {
  const typeParameter = { name: "T" };
  const typeParameterRef: ProviderTypeExpression = { kind: "type-parameter", name: "T" };
  const parameters = declaration.marker === "defaultof"
    ? []
    : [{ name: "value", type: typeParameterRef, optional: declaration.marker !== "out" && declaration.marker !== "ref" && declaration.marker !== "inref" }];
  return {
    id: declaration.exportName,
    name: declaration.exportName,
    kind: "function",
    signatures: [{
      id: `${declaration.exportName}<T>`,
      typeParameters: [typeParameter],
      parameters,
      returnType: typeParameterRef,
    }],
  };
}

function typeMarkerToProviderDeclaration(declaration: SourceTypeMarkerDeclaration): ProviderExportDeclaration {
  return {
    id: declaration.exportName,
    name: declaration.exportName,
    kind: "type",
    typeParameters: [{ name: "T" }],
    type: { kind: "unknown" },
  };
}

function getCsharpPrimitiveTargetIdentity(primitive: SourcePrimitiveKind): string {
  switch (primitive) {
    case "bool":
      return "System.Boolean";
    case "char":
      return "System.Char";
    case "int8":
      return "System.SByte";
    case "uint8":
      return "System.Byte";
    case "int16":
      return "System.Int16";
    case "uint16":
      return "System.UInt16";
    case "int32":
      return "System.Int32";
    case "uint32":
      return "System.UInt32";
    case "int64":
      return "System.Int64";
    case "uint64":
      return "System.UInt64";
    case "native-int":
      return "System.IntPtr";
    case "native-uint":
      return "System.UIntPtr";
    case "float16":
      return "System.Half";
    case "float32":
      return "System.Single";
    case "float64":
      return "System.Double";
    case "decimal":
      return "System.Decimal";
    case "int128":
      return "System.Int128";
    case "uint128":
      return "System.UInt128";
  }
}

function getCsharpPrimitiveDisplayName(primitive: SourcePrimitiveKind): string {
  switch (primitive) {
    case "bool":
      return "bool";
    case "char":
      return "char";
    case "int8":
      return "sbyte";
    case "uint8":
      return "byte";
    case "int16":
      return "short";
    case "uint16":
      return "ushort";
    case "int32":
      return "int";
    case "uint32":
      return "uint";
    case "int64":
      return "long";
    case "uint64":
      return "ulong";
    case "native-int":
      return "nint";
    case "native-uint":
      return "nuint";
    case "float16":
      return "Half";
    case "float32":
      return "float";
    case "float64":
      return "double";
    case "decimal":
      return "decimal";
    case "int128":
      return "Int128";
    case "uint128":
      return "UInt128";
  }
}
