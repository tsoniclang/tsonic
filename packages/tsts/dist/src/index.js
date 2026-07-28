export { CommandLine } from "./internal/execute/tsc.js";
export { ExtensionDiagnosticStore, ExtensionFactResolver, ExtensionFactStore, ExtensionHost, ExtensionHostDiagnosticCode, ProviderRegistry, TstsSourceProviderContractVersion, argumentPassingFactKey, associatedTypeFactKey, attachExtensionHost, attachExtensionHostToProgram, attributeFactKey, canonicalIdentityFactKey, constGenericFactKey, createSourceFactQueries, createSourceSemanticsExtension, defaultValueFactKey, defineExtensionFactKey, fieldFactKey, flowStateFactKey, functionPointerFactKey, getExtensionHost, hasExtensionHost, pointerFactKey, providerTypeFamilyFactKey, providerVirtualDeclarationFactKey, sourcePrimitive, sourceSemanticsExtensionId, sourcePrimitiveFactKey, SourceFactQueries, structFactKey, } from "./extensions/index.js";
export { ParseBuildCommandLine, ParseCommandLine } from "./internal/tsoptions/commandlineparser.js";
export { barebonesLibContent, formatDiagnostics, transpile, transpileDeclaration, transpileModule } from "./services/transpile.js";
export { createTypeCheckerQueries } from "./services/type-checker.js";
export { createCompilerHost, createInMemoryFileSystem, getBundledLibraryPath, withBundledLibraries } from "./services/embedding-host.js";
export { createAstReader } from "./services/ast-reader.js";
export { createCompilerSession, createCompilerSessionFromFiles, createCompilerSessionFromProgram } from "./services/compiler-session.js";
export { createTypeShapeQueries } from "./services/type-shape.js";
//# sourceMappingURL=index.js.map