export { CommandLine } from "./internal/execute/tsc.js";
export { TstsSourceProviderContractVersion, argumentPassingFactKey, associatedTypeFactKey, attributeFactKey, canonicalIdentityFactKey, constGenericFactKey, createSourceSemanticsExtension, defaultValueFactKey, defineExtensionFactKey, fieldFactKey, getProviderMemberSurfaceKey, isProviderWellKnownSymbolName, flowStateFactKey, functionPointerFactKey, pointerFactKey, pointerOperationFactKey, rawPointerFactKey, rawPointerOperationFactKey, providerTypeFamilyFactKey, providerVirtualDeclarationFactKey, sourcePrimitive, sourceSemanticsExtensionId, sourcePrimitiveFactKey, sourceMarkerFactKey, structFactKey, } from "./extensions/index.js";
export { ParseBuildCommandLine, ParseCommandLine } from "./internal/tsoptions/commandlineparser.js";
export { barebonesLibContent, flattenDiagnosticMessageText, formatDiagnostics, transpile, transpileDeclaration, transpileModule } from "./services/transpile.js";
export { createCompilerHost, createInMemoryFileSystem, getBundledLibraryClosure, getBundledLibraryPath, withBundledLibraries } from "./services/embedding-host.js";
export { createCompilerSession, createCompilerSessionFromFiles, createCompilerSessionFromProgram } from "./services/compiler-session.js";
export * from "./internal/ast/symbolflags.js";
export { NodeFlagsNone, NodeFlagsLet, NodeFlagsConst, NodeFlagsUsing, NodeFlagsReparsed, NodeFlagsSynthesized, NodeFlagsOptionalChain, NodeFlagsExportContext, NodeFlagsContainsThis, NodeFlagsHasImplicitReturn, NodeFlagsHasExplicitReturn, NodeFlagsDisallowInContext, NodeFlagsYieldContext, NodeFlagsDecoratorContext, NodeFlagsAwaitContext, NodeFlagsDisallowConditionalTypesContext, NodeFlagsThisNodeHasError, NodeFlagsJavaScriptFile, NodeFlagsThisNodeOrAnySubNodesHasError, NodeFlagsHasAsyncFunctions, NodeFlagsPossiblyContainsDynamicImport, NodeFlagsPossiblyContainsImportMeta, NodeFlagsHasJSDoc, NodeFlagsJSDoc, NodeFlagsAmbient, NodeFlagsInWithStatement, NodeFlagsJsonFile, NodeFlagsPossiblyContainsDeprecatedTag, NodeFlagsUnreachable, NodeFlagsReparserTransformedLiteral, NodeFlagsBlockScoped, NodeFlagsConstant, NodeFlagsAwaitUsing, NodeFlagsReachabilityCheckFlags, NodeFlagsReachabilityAndEmitFlags, NodeFlagsContextFlags, NodeFlagsTypeExcludesFlags, NodeFlagsPermanentlySetIncrementalFlags, NodeFlagsIdentifierHasExtendedUnicodeEscape, NodeFlagsIdentifierIsInJSDocNamespace, NodeFlagsNestedNamespace, } from "./internal/ast/generated/flags.js";
export * from "./internal/ast/tokenflags.js";
export * from "./internal/core/scriptkind.js";
export { ScriptKind_String } from "./internal/core/scriptkind_stringer_generated.js";
export * from "./internal/core/languagevariant.js";
export { LanguageVariant_String } from "./internal/core/languagevariant_stringer_generated.js";
export { CommentDirectiveKindExpectError, CommentDirectiveKindIgnore, CommentDirectiveKindUnknown } from "./internal/ast/ast.js";
export { readOriginalSignature } from "./internal/checker/original-signature-evidence.js";
export { ContextFlagsSkipBindingPatterns, TypeFlagsUniqueESSymbol } from "./internal/checker/types.js";
export { prepareSourceImports } from "./services/source-import-preparation.js";
//# sourceMappingURL=index.js.map